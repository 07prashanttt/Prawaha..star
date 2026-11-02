(() => {
  const $ = (id) => document.getElementById(id);
  const cfg = window.PRAWaha_CONFIG || {};
  const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  let sb = null, user = null, currentFeed = "for-you", activeVideo = null;
  const videoCache = new Map();
  const toast = (msg) => { $("toast").textContent = msg; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 2600); };
  const msg = (id, text) => { $(id).textContent = text || ""; };
  const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  async function boot() {
    await wait(1200);
    $("splash").classList.add("hidden");
    if (!ready || !window.supabase) {
      $("auth").classList.remove("hidden");
      msg("auth-message", "Setup required: add your Supabase URL and anon/publishable key in config.js.");
      return;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const { data: { session } } = await sb.auth.getSession();
    if (session) { user = session.user; await showApp(); } else $("auth").classList.remove("hidden");
    sb.auth.onAuthStateChange(async (_event, session) => {
      if (session && !user) { user = session.user; await showApp(); }
      if (!session && user) { user = null; showAuth(); }
    });
  }
  function showAuth() { $("app").classList.add("hidden"); $("auth").classList.remove("hidden"); }
  async function showApp() {
    $("auth").classList.add("hidden"); $("app").classList.remove("hidden");
    await ensureProfile(); await loadProfile(); await loadFeed();
  }
  async function ensureProfile() {
    const { data } = await sb.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!data) await sb.from("profiles").insert({id:user.id, display_name:(user.user_metadata?.full_name || user.email?.split("@")[0] || "Creator").slice(0,30)});
  }

  document.querySelectorAll("[data-auth-tab]").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===b));
    $("email-panel").classList.toggle("hidden", b.dataset.authTab!=="email");
    $("phone-panel").classList.toggle("hidden", b.dataset.authTab!=="phone");
    msg("auth-message","");
  }));
  $("email-signup").addEventListener("click", async () => {
    if (!sb) return;
    const email=$("email").value.trim(), password=$("password").value;
    if (!email || password.length<8) return msg("auth-message","Enter a valid email and password with at least 8 characters.");
    const {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
    msg("auth-message",error?.message || "Account created. Check your email to confirm, then log in.");
  });
  $("email-login").addEventListener("click", async () => {
    if (!sb) return;
    const {error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    msg("auth-message",error?.message || "Logged in.");
  });
  $("forgot-password").addEventListener("click", async () => {
    if (!sb) return;
    const email=$("email").value.trim(); if(!email) return msg("auth-message","Enter your email first.");
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
    msg("auth-message",error?.message || "Password reset email sent.");
  });
  $("google-login").addEventListener("click", async () => {
    if (!sb) return;
    const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin}});
    if(error) msg("auth-message",error.message);
  });
  $("send-otp").addEventListener("click", async () => {
    if (!sb) return;
    const phone=$("phone").value.trim();
    if(!/^\+[1-9]\d{7,14}$/.test(phone)) return msg("auth-message","Use international format, e.g. +97798XXXXXXXX.");
    const {error}=await sb.auth.signInWithOtp({phone});
    msg("auth-message",error?.message || "OTP sent. Check your SMS.");
  });
  $("verify-otp").addEventListener("click", async () => {
    if (!sb) return;
    const {error}=await sb.auth.verifyOtp({phone:$("phone").value.trim(),token:$("otp").value.trim(),type:"sms"});
    msg("auth-message",error?.message || "Phone verified.");
  });

  function navigate(page) {
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("hidden",p.id!==page));
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    if(page==="profile-page") loadProfile();
    if(page==="feed-page") loadFeed();
  }
  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
  $("profile-open").addEventListener("click",()=>navigate("profile-page"));
  $("search-open").addEventListener("click",()=>navigate("search-page"));
  document.querySelectorAll("[data-feed]").forEach(b=>b.addEventListener("click",()=>{
    currentFeed=b.dataset.feed; document.querySelectorAll("[data-feed]").forEach(x=>x.classList.toggle("active",x===b)); loadFeed();
  }));

  async function loadFeed() {
    if(!sb || !user) return;
    $("feed").innerHTML='<div class="loading">Loading videos…</div>';
    let query=sb.from("videos").select("id,user_id,caption,video_path,created_at,profiles(display_name)").eq("status","published").order("created_at",{ascending:false}).limit(30);
    if(currentFeed==="following") {
      const {data:follows}=await sb.from("follows").select("following_id").eq("follower_id",user.id);
      const ids=(follows||[]).map(x=>x.following_id);
      if(!ids.length){$("feed").innerHTML='<div class="empty">Follow creators to see their videos here.</div>';return;}
      query=query.in("user_id",ids);
    }
    const {data,error}=await query;
    if(error){$("feed").innerHTML='<div class="empty">Could not load videos. Check your database setup.</div>';return;}
    if(!data?.length){$("feed").innerHTML='<div class="empty">No videos yet. Be the first to upload one.</div>';return;}
    $("feed").innerHTML="";
    for(const v of data) await renderVideo(v,$("feed"));
    setupAutoplay();
  }
  async function renderVideo(v,container) {
    const {data:publicData}=sb.storage.from("videos").getPublicUrl(v.video_path);
    const [{count:likes},{count:comments},{data:myLike}] = await Promise.all([
      sb.from("likes").select("*",{count:"exact",head:true}).eq("video_id",v.id),
      sb.from("comments").select("*",{count:"exact",head:true}).eq("video_id",v.id),
      sb.from("likes").select("video_id").eq("video_id",v.id).eq("user_id",user.id).maybeSingle()
    ]);
    const name=v.profiles?.display_name || "Creator";
    const card=document.createElement("article"); card.className="video-card"; card.dataset.videoId=v.id;
    card.innerHTML=`<video src="${esc(publicData.publicUrl)}" playsinline loop muted preload="metadata" controls></video><div class="video-shade"></div>
      <div class="video-meta"><b>@${esc(name)}</b><p>${esc(v.caption)}</p></div>
      <div class="video-actions">
        <button class="action like-btn ${myLike?"liked":""}" aria-label="Like">♥<small>${likes||0}</small></button>
        <button class="action comment-btn" aria-label="Comments">▤<small>${comments||0}</small></button>
        <button class="action follow-btn" aria-label="Follow">＋<small>Follow</small></button>
        <button class="action share-btn" aria-label="Share">↗<small>Share</small></button>
        <button class="action report-btn" aria-label="Report">⚑<small>Report</small></button>
      </div>`;
    container.append(card);
    card.querySelector("video").addEventListener("click",e=>{const vid=e.currentTarget; if(vid.paused)vid.play().catch(()=>{});else vid.pause();});
    card.querySelector(".like-btn").addEventListener("click",async()=>{
      const b=card.querySelector(".like-btn"), had=b.classList.contains("liked");
      if(had){await sb.from("likes").delete().eq("video_id",v.id).eq("user_id",user.id);b.classList.remove("liked");}
      else {const {error}=await sb.from("likes").insert({video_id:v.id,user_id:user.id});if(error&&error.code!=="23505")return toast(error.message);b.classList.add("liked");}
      const {count}=await sb.from("likes").select("*",{count:"exact",head:true}).eq("video_id",v.id);b.querySelector("small").textContent=count||0;
    });
    card.querySelector(".comment-btn").addEventListener("click",()=>openComments(v.id,card));
    card.querySelector(".follow-btn").addEventListener("click",async()=>{
      if(v.user_id===user.id)return toast("This is your video.");
      const {error}=await sb.from("follows").upsert({follower_id:user.id,following_id:v.user_id},{onConflict:"follower_id,following_id"});
      toast(error?error.message:"Following creator.");
    });
    card.querySelector(".share-btn").addEventListener("click",async()=>{
      const url=location.origin+location.pathname+"?video="+v.id;
      try{if(navigator.share)await navigator.share({title:"Prawaha Star video",url});else{await navigator.clipboard.writeText(url);toast("Video link copied.");}}catch{}
    });
    card.querySelector(".report-btn").addEventListener("click",()=>{activeVideo=v.id;$("report-dialog").showModal();});
  }
  function setupAutoplay(){
    const videos=[...document.querySelectorAll(".video-card video")];
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
      const v=e.target;
      if(e.isIntersecting&&e.intersectionRatio>.65){videos.forEach(x=>{if(x!==v)x.pause();});v.play().catch(()=>{});}
      else v.pause();
    }),{threshold:[0,.65,1]});
    videos.forEach(v=>observer.observe(v));
  }
  async function openComments(videoId,card){
    activeVideo=videoId; $("comments-list").innerHTML='<p class="muted">Loading…</p>'; $("comments-dialog").showModal();
    const {data,error}=await sb.from("comments").select("id,body,created_at,profiles(display_name)").eq("video_id",videoId).order("created_at",{ascending:true}).limit(100);
    if(error){$("comments-list").textContent=error.message;return;}
    $("comments-list").innerHTML=(data||[]).map(c=>`<div class="comment"><b>${esc(c.profiles?.display_name||"Creator")}</b><p>${esc(c.body)}</p></div>`).join("")||'<p class="muted">No comments yet.</p>';
  }
  $("comments-close").addEventListener("click",()=>$("comments-dialog").close());
  $("comment-form").addEventListener("submit",async e=>{
    e.preventDefault();const body=$("comment-text").value.trim();if(!body||!activeVideo)return;
    const {error}=await sb.from("comments").insert({video_id:activeVideo,user_id:user.id,body});
    if(error)return toast(error.message);$("comment-text").value="";openComments(activeVideo);
  });
  $("report-close").addEventListener("click",()=>$("report-dialog").close());
  $("report-form").addEventListener("submit",async e=>{
    e.preventDefault();const {error}=await sb.from("reports").insert({video_id:activeVideo,reporter_id:user.id,reason:$("report-reason").value,details:$("report-details").value.trim()});
    $("report-dialog").close();toast(error?error.message:"Report submitted. Thank you.");$("report-details").value="";
  });

  $("upload-form").addEventListener("submit",async e=>{
    e.preventDefault();const file=$("video-file").files[0],caption=$("video-caption").value.trim();
    if(!file||!caption||!$("confirm-rights").checked)return;
    if(file.size>100*1024*1024)return msg("upload-message","Maximum file size is 100 MB in this starter.");
    if(!["video/mp4","video/webm","video/quicktime"].includes(file.type))return msg("upload-message","Choose MP4, WebM, or MOV video.");
    msg("upload-message","Uploading video…");
    const ext=(file.name.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await sb.storage.from("videos").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError)return msg("upload-message",uploadError.message);
    const {error:dbError}=await sb.from("videos").insert({user_id:user.id,caption,video_path:path,status:"published"});
    if(dbError){await sb.storage.from("videos").remove([path]);return msg("upload-message",dbError.message);}
    msg("upload-message","Uploaded! Your video is now in the feed.");$("upload-form").reset();navigate("feed-page");
  });
  async function loadProfile(){
    if(!sb||!user)return;
    const {data:p}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
    $("profile-name").textContent=p?.display_name||"Creator";$("display-name").value=p?.display_name||"";
    $("profile-email").textContent=user.email||user.phone||"";
    const [{count:videos},{count:followers},{count:following},{data:mine}]=await Promise.all([
      sb.from("videos").select("*",{count:"exact",head:true}).eq("user_id",user.id),
      sb.from("follows").select("*",{count:"exact",head:true}).eq("following_id",user.id),
      sb.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",user.id),
      sb.from("videos").select("id,video_path").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30)
    ]);
    $("my-video-count").textContent=videos||0;$("my-followers").textContent=followers||0;$("my-following").textContent=following||0;
    $("my-videos").innerHTML="";
    (mine||[]).forEach(v=>{const {data}=sb.storage.from("videos").getPublicUrl(v.video_path);const el=document.createElement("div");el.className="my-video";el.innerHTML=`<video src="${esc(data.publicUrl)}" muted playsinline preload="metadata"></video>`;$("my-videos").append(el);});
  }
  $("save-profile").addEventListener("click",async()=>{
    const display_name=$("display-name").value.trim().slice(0,30);if(!display_name)return toast("Enter a display name.");
    const {error}=await sb.from("profiles").upsert({id:user.id,display_name,updated_at:new Date().toISOString()});
    toast(error?error.message:"Profile saved.");if(!error)loadProfile();
  });
  $("logout").addEventListener("click",async()=>{await sb.auth.signOut();user=null;showAuth();});
  $("search-input").addEventListener("input",async()=>{
    const term=$("search-input").value.trim();if(term.length<2){$("search-results").innerHTML="";return;}
    const {data,error}=await sb.from("videos").select("id,caption,profiles(display_name)").eq("status","published").ilike("caption",`%${term.replace(/[%_]/g,"\\$&")}%`).limit(20);
    if(error){$("search-results").textContent=error.message;return;}
    $("search-results").innerHTML=(data||[]).map(v=>`<div class="result-row"><b>@${esc(v.profiles?.display_name||"Creator")}</b><p>${esc(v.caption)}</p></div>`).join("")||'<p class="muted">No matches found.</p>';
  });
  $("contact-form").addEventListener("submit",async e=>{
    e.preventDefault();msg("contact-message","Contact form is a demo in this starter. Add a protected support endpoint before launch.");
  });
  if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  boot();
})();