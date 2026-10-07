/* CineXplore - HTML/CSS/JS frontend using TMDB API. Replace the token below. */
const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0ZmVkY2M3OGZiNDk4ZWNiMTc0ZjliNjQyNjEyMWE3NiIsIm5iZiI6MTc5MTM4Mzc1NS4wNzIsInN1YiI6IjZhYzY1OGNiNWFmZmEwOWE2Yjk1ZTMxMSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.qsEdy2DupSifJkqWLzjDAUOqDj1Lhx0qFzPWa8eGblE";
const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/";
const POSTER_SIZE = "w500";
const BACKDROP_SIZE = "w1280";
const PROFILE_SIZE = "w185";

const state = { currentPage:"home", moviePage:1, seriesPage:1, movieMode:"popular", seriesMode:"popular", movieTotalPages:1, seriesTotalPages:1, currentDetail:null, favorites:loadFavorites(), movieGenres:{}, tvGenres:{} };
document.addEventListener("DOMContentLoaded", init);

async function init(){
  bindNavigation(); bindGlobalSearch(); bindSearchControls(); bindFilterControls(); bindModalControls();
  fillYears("movieYear"); fillYears("seriesYear"); updateFavoriteBadge();
  if(!TMDB_TOKEN || TMDB_TOKEN.includes("PASTE_YOUR")){ showToast("Add your TMDB API Read Access Token in script.js."); showInitialError("movieGrid","TMDB token is missing."); showInitialError("seriesGrid","TMDB token is missing."); return; }
  await Promise.all([loadGenres(), loadHome()]);
  await loadMovies({reset:true});
}

function authHeaders(){ return {accept:"application/json", Authorization:`Bearer ${TMDB_TOKEN}`}; }
async function apiFetch(endpoint){
  const separator=endpoint.includes("?")?"&":"?";
  const response=await fetch(`${API_BASE}${endpoint}${separator}language=en-US`,{headers:authHeaders()});
  if(response.status===401) throw new Error("TMDB authentication failed. Check your Read Access Token.");
  if(!response.ok){ let message=`TMDB request failed: ${response.status}`; try{const body=await response.json(); if(body.status_message) message=body.status_message;}catch{} throw new Error(message); }
  return response.json();
}

function bindNavigation(){
  document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>{
    const page=el.dataset.page; if(!page)return; switchPage(page);
    if(page==="movies") { state.movieMode="popular"; loadMovies({reset:true}); }
    if(page==="series") { state.seriesMode="popular"; loadSeries({reset:true}); }
    if(page==="favorites") renderFavorites();
  }));
  document.querySelector(".brand").addEventListener("click",e=>{e.preventDefault();switchPage("home");});
}
function switchPage(page){
  state.currentPage=page; document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));
  document.getElementById(`page-${page}`).classList.add("active-page");
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  window.scrollTo({top:0,behavior:"smooth"});
}
function bindGlobalSearch(){ document.getElementById("globalSearchButton").addEventListener("click",()=>{ switchPage("movies"); document.getElementById("movieSearchInput").focus(); }); }
function bindSearchControls(){
  const hi=document.getElementById("homeSearchInput"); const hb=document.getElementById("homeSearchButton"); hb.addEventListener("click",()=>runHomeSearch(hi.value)); hi.addEventListener("keydown",e=>{if(e.key==="Enter")runHomeSearch(hi.value)});
  const mi=document.getElementById("movieSearchInput"); document.getElementById("movieSearchButton").addEventListener("click",()=>runMovieSearch(mi.value)); mi.addEventListener("keydown",e=>{if(e.key==="Enter")runMovieSearch(mi.value)});
  const si=document.getElementById("seriesSearchInput"); document.getElementById("seriesSearchButton").addEventListener("click",()=>runSeriesSearch(si.value)); si.addEventListener("keydown",e=>{if(e.key==="Enter")runSeriesSearch(si.value)});
  document.getElementById("movieLoadMore").addEventListener("click",()=>{if(state.moviePage<state.movieTotalPages){state.moviePage++;loadMovies({reset:false});}});
  document.getElementById("seriesLoadMore").addEventListener("click",()=>{if(state.seriesPage<state.seriesTotalPages){state.seriesPage++;loadSeries({reset:false});}});
}
function bindFilterControls(){
  ["movieGenre","movieYear","movieRating","movieSort"].forEach(id=>document.getElementById(id).addEventListener("change",()=>{state.movieMode="discover";state.moviePage=1;loadMovies({reset:true});}));
  ["seriesGenre","seriesYear","seriesRating","seriesSort"].forEach(id=>document.getElementById(id).addEventListener("change",()=>{state.seriesMode="discover";state.seriesPage=1;loadSeries({reset:true});}));
}
function bindModalControls(){
  document.getElementById("closeModal").addEventListener("click",closeModal); document.getElementById("modalBackdrop").addEventListener("click",closeModal);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
  document.getElementById("detailFavoriteButton").addEventListener("click",()=>{if(!state.currentDetail)return;toggleFavorite(normalizeItem(state.currentDetail.item,state.currentDetail.type),{refreshModal:true});});
  document.getElementById("seasonSelect").addEventListener("change",e=>{if(state.currentDetail?.type==="tv")loadSeasonEpisodes(state.currentDetail.id,Number(e.target.value));});
}

async function loadHome(){
  try{ const [popular,nowPlaying]=await Promise.all([apiFetch("/movie/popular?page=1"),apiFetch("/movie/now_playing?page=1")]);
    renderGrid(document.getElementById("homePopularGrid"),popular.results.slice(0,5)); renderGrid(document.getElementById("homeNowPlayingGrid"),nowPlaying.results.slice(0,5)); if(popular.results.length) await setHero(popular.results[0]);
  }catch(e){console.error(e);showToast(e.message);}
}
async function setHero(movie){
  const backdrop=movie.backdrop_path?`${IMAGE_BASE}${BACKDROP_SIZE}${movie.backdrop_path}`:""; const poster=movie.poster_path?`${IMAGE_BASE}${POSTER_SIZE}${movie.poster_path}`:placeholderPoster();
  document.querySelector(".hero-backdrop").style.backgroundImage=backdrop?`url("${backdrop}")`:"none"; document.getElementById("heroPoster").src=poster; document.getElementById("heroTitle").textContent=movie.title||"Untitled"; document.getElementById("heroRating").textContent=`★ ${rating(movie.vote_average)}`; document.getElementById("heroDate").textContent=year(movie.release_date); document.getElementById("heroOverview").textContent=movie.overview||"Discover something new to watch."; document.getElementById("heroMiniOverview").textContent=movie.overview||"Featured title from TMDB."; document.getElementById("heroDetailButton").onclick=()=>openDetails(movie.id,"movie");
}
async function loadGenres(){
  try{const [m,t]=await Promise.all([apiFetch("/genre/movie/list"),apiFetch("/genre/tv/list")]);state.movieGenres=Object.fromEntries(m.genres.map(g=>[g.id,g.name]));state.tvGenres=Object.fromEntries(t.genres.map(g=>[g.id,g.name]));fillGenreSelect("movieGenre",m.genres);fillGenreSelect("seriesGenre",t.genres);}catch(e){console.error(e);showToast(e.message)}
}
function fillGenreSelect(id,genres){const s=document.getElementById(id);s.innerHTML=`<option value="">All genres</option>`;genres.forEach(g=>s.insertAdjacentHTML("beforeend",`<option value="${g.id}">${escapeHtml(g.name)}</option>`));}
function fillYears(id){const s=document.getElementById(id),cur=new Date().getFullYear();for(let y=cur;y>=1980;y--)s.insertAdjacentHTML("beforeend",`<option value="${y}">${y}</option>`)}

async function loadMovies({reset}){
  const grid=document.getElementById("movieGrid"); if(reset){state.moviePage=1;grid.innerHTML=skeletonCards(8);}
  try{
    let data;
    if(state.movieMode==="popular"){data=await apiFetch(`/movie/popular?page=${state.moviePage}`);document.getElementById("movieResultsLabel").textContent="Popular movies";}
    else if(state.movieMode==="search"){return;}
    else{const p=new URLSearchParams({include_adult:"false",include_video:"false",page:String(state.moviePage),sort_by:document.getElementById("movieSort").value});const g=document.getElementById("movieGenre").value,y=document.getElementById("movieYear").value,r=document.getElementById("movieRating").value;if(g)p.set("with_genres",g);if(y)p.set("primary_release_year",y);if(r)p.set("vote_average.gte",r);data=await apiFetch(`/discover/movie?${p}`);document.getElementById("movieResultsLabel").textContent="Filtered movies";}
    if(reset)grid.innerHTML="";appendItems(grid,data.results,"movie");state.movieTotalPages=Math.min(data.total_pages||1,500);document.getElementById("movieResultsCount").textContent=`${(data.total_results||0).toLocaleString()} titles`;document.getElementById("movieLoadMore").classList.toggle("hidden",state.moviePage>=state.movieTotalPages);
  }catch(e){console.error(e);grid.innerHTML="";showInitialError("movieGrid",e.message);showToast(e.message)}
}
async function loadSeries({reset}){
  const grid=document.getElementById("seriesGrid"); if(reset){state.seriesPage=1;grid.innerHTML=skeletonCards(8);}
  try{
    let data;
    if(state.seriesMode==="popular"){data=await apiFetch(`/tv/popular?page=${state.seriesPage}`);document.getElementById("seriesResultsLabel").textContent="Popular TV series";}
    else if(state.seriesMode==="search"){return;}
    else{const p=new URLSearchParams({include_adult:"false",include_null_first_air_dates:"false",page:String(state.seriesPage),sort_by:document.getElementById("seriesSort").value});const g=document.getElementById("seriesGenre").value,y=document.getElementById("seriesYear").value,r=document.getElementById("seriesRating").value;if(g)p.set("with_genres",g);if(y)p.set("first_air_date_year",y);if(r)p.set("vote_average.gte",r);data=await apiFetch(`/discover/tv?${p}`);document.getElementById("seriesResultsLabel").textContent="Filtered TV series";}
    if(reset)grid.innerHTML="";appendItems(grid,data.results,"tv");state.seriesTotalPages=Math.min(data.total_pages||1,500);document.getElementById("seriesResultsCount").textContent=`${(data.total_results||0).toLocaleString()} titles`;document.getElementById("seriesLoadMore").classList.toggle("hidden",state.seriesPage>=state.seriesTotalPages);
  }catch(e){console.error(e);grid.innerHTML="";showInitialError("seriesGrid",e.message);showToast(e.message)}
}
async function runHomeSearch(q){q=q.trim();if(!q)return;switchPage("movies");document.getElementById("movieSearchInput").value=q;await runMovieSearch(q)}
async function runMovieSearch(q){q=q.trim();const grid=document.getElementById("movieGrid");if(!q){state.movieMode="popular";state.moviePage=1;await loadMovies({reset:true});return}grid.innerHTML=skeletonCards(8);try{const data=await apiFetch(`/search/movie?query=${encodeURIComponent(q)}&include_adult=false&page=1`);state.movieMode="search";state.moviePage=1;state.movieTotalPages=Math.min(data.total_pages||1,500);grid.innerHTML="";appendItems(grid,data.results,"movie");document.getElementById("movieResultsLabel").textContent=`Search results for "${q}"`;document.getElementById("movieResultsCount").textContent=`${data.total_results||0} titles`;document.getElementById("movieLoadMore").classList.add("hidden");}catch(e){console.error(e);grid.innerHTML="";showInitialError("movieGrid",e.message);showToast(e.message)}}
async function runSeriesSearch(q){q=q.trim();const grid=document.getElementById("seriesGrid");if(!q){state.seriesMode="popular";state.seriesPage=1;await loadSeries({reset:true});return}grid.innerHTML=skeletonCards(8);try{const data=await apiFetch(`/search/tv?query=${encodeURIComponent(q)}&include_adult=false&page=1`);state.seriesMode="search";state.seriesPage=1;state.seriesTotalPages=Math.min(data.total_pages||1,500);grid.innerHTML="";appendItems(grid,data.results,"tv");document.getElementById("seriesResultsLabel").textContent=`Search results for "${q}"`;document.getElementById("seriesResultsCount").textContent=`${data.total_results||0} titles`;document.getElementById("seriesLoadMore").classList.add("hidden");}catch(e){console.error(e);grid.innerHTML="";showInitialError("seriesGrid",e.message);showToast(e.message)}}
function renderGrid(container,items){container.innerHTML="";appendItems(container,items,"movie")}
function appendItems(container,items,type){if(!items?.length){if(!container.children.length)container.innerHTML=`<div class="empty-state" style="grid-column:1/-1;min-height:260px"><div class="empty-icon">⌕</div><h3>No titles found</h3><p>Try another search or change your filters.</p></div>`;return}items.forEach(item=>container.appendChild(createCard(item,type)))}
function createCard(item,type){const n=normalizeItem(item,type),fav=isFavoriteItem(n),card=document.createElement("article");card.className="movie-card";const poster=n.poster_path?`${IMAGE_BASE}${POSTER_SIZE}${n.poster_path}`:placeholderPoster();card.innerHTML=`<div class="poster-wrap"><img loading="lazy" src="${poster}" alt="${escapeHtml(n.title)} poster"/><button class="favorite-toggle ${fav?"is-favorite":""}" title="${fav?"Remove from favorites":"Add to favorites"}" aria-label="${fav?"Remove from favorites":"Add to favorites"}">${fav?"♥":"♡"}</button><button class="poster-play" title="View details" aria-label="View details">▶</button></div><div class="movie-info"><h3>${escapeHtml(n.title)}</h3><div class="meta-line"><span class="rating">★ ${rating(n.vote_average)}</span><span>${year(n.date)}</span><span>${type==="movie"?"Movie":"Series"}</span></div></div>`;card.querySelector("img").addEventListener("error",e=>e.target.src=placeholderPoster());card.querySelector(".favorite-toggle").addEventListener("click",e=>{e.stopPropagation();toggleFavorite(n);const next=isFavoriteItem(n);e.currentTarget.classList.toggle("is-favorite",next);e.currentTarget.textContent=next?"♥":"♡"});card.querySelector(".poster-play").addEventListener("click",e=>{e.stopPropagation();openDetails(n.id,type)});card.addEventListener("click",()=>openDetails(n.id,type));return card}

async function openDetails(id,type){showToast("Loading details...");try{const endpoint=type==="movie"?`/movie/${id}?append_to_response=credits,videos`:`/tv/${id}?append_to_response=credits,videos`;const data=await apiFetch(endpoint);state.currentDetail={id,type,item:data};const title=data.title||data.name||"Untitled",date=data.release_date||data.first_air_date||"",backdrop=data.backdrop_path?`${IMAGE_BASE}${BACKDROP_SIZE}${data.backdrop_path}`:placeholderBackdrop(),poster=data.poster_path?`${IMAGE_BASE}${POSTER_SIZE}${data.poster_path}`:placeholderPoster();document.getElementById("detailBackdrop").src=backdrop;document.getElementById("detailPoster").src=poster;document.getElementById("detailTitle").textContent=title;document.getElementById("detailType").textContent=type==="movie"?"MOVIE":"TV SERIES";document.getElementById("detailMeta").innerHTML=`<span>★ ${rating(data.vote_average)}</span><span>${year(date)}</span><span>${type==="movie"?movieRuntime(data.runtime):`${data.number_of_seasons||0} season(s)`}</span>`;document.getElementById("detailOverview").textContent=data.overview||"No overview available.";document.getElementById("detailGenres").textContent=data.genres?.map(g=>g.name).join(", ")||"—";if(type==="movie"){const director=data.credits?.crew?.find(p=>p.job==="Director");document.getElementById("detailCreator").textContent=director?.name||"—";document.getElementById("detailRuntime").textContent=movieRuntime(data.runtime)}else{document.getElementById("detailCreator").textContent=data.created_by?.map(p=>p.name).join(", ")||"—";document.getElementById("detailRuntime").textContent=`${data.number_of_seasons||0} season(s), ${data.number_of_episodes||0} episode(s)`}renderCast(data.credits?.cast||[]);renderFavoriteButton(data,type);setupSeasons(data,type);document.getElementById("detailsModal").classList.remove("hidden");document.body.style.overflow="hidden"}catch(e){console.error(e);showToast(e.message)}}
function renderCast(cast){const list=document.getElementById("castList");list.innerHTML="";const top=cast.slice(0,8);if(!top.length){list.innerHTML=`<span class="muted-small">No cast information available.</span>`;return}top.forEach(p=>{const profile=p.profile_path?`${IMAGE_BASE}${PROFILE_SIZE}${p.profile_path}`:placeholderProfile();const card=document.createElement("div");card.className="cast-card";card.innerHTML=`<img src="${profile}" alt="${escapeHtml(p.name||"Cast member")}"/><strong>${escapeHtml(p.name||"Unknown")}</strong><span>${escapeHtml(p.character||"")}</span>`;list.appendChild(card)})}
function setupSeasons(data,type){const block=document.getElementById("seasonBlock"),select=document.getElementById("seasonSelect");if(type!=="tv"||!Array.isArray(data.seasons)||!data.seasons.length){block.classList.add("hidden");return}const seasons=data.seasons.filter(s=>s.season_number>=0);select.innerHTML=seasons.map(s=>`<option value="${s.season_number}">${escapeHtml(s.name||`Season ${s.season_number}`)}</option>`).join("");block.classList.remove("hidden");if(seasons[0])loadSeasonEpisodes(data.id,seasons[0].season_number)}
async function loadSeasonEpisodes(id,season){const list=document.getElementById("episodeList");list.innerHTML=`<span class="muted-small">Loading episodes...</span>`;try{const data=await apiFetch(`/tv/${id}/season/${season}`);list.innerHTML="";if(!data.episodes?.length){list.innerHTML=`<span class="muted-small">No episodes available.</span>`;return}data.episodes.forEach(ep=>{const img=ep.still_path?`${IMAGE_BASE}w300${ep.still_path}`:placeholderEpisode(),row=document.createElement("div");row.className="episode";row.innerHTML=`<img src="${img}" alt="${escapeHtml(ep.name||"Episode")}"/><div><h4>E${String(ep.episode_number).padStart(2,"0")} · ${escapeHtml(ep.name||"Untitled episode")}</h4><p>${escapeHtml(ep.overview||"No episode overview available.")}</p></div><span class="episode-score">★ ${rating(ep.vote_average)}</span>`;list.appendChild(row)})}catch(e){console.error(e);list.innerHTML=`<span class="muted-small">${escapeHtml(e.message)}</span>`}}
function renderFavoriteButton(item,type){const n=normalizeItem(item,type),saved=isFavoriteItem(n),b=document.getElementById("detailFavoriteButton");b.textContent=saved?"♥ Remove from favorites":"♡ Add to favorites";b.classList.toggle("is-favorite",saved)}
function closeModal(){document.getElementById("detailsModal").classList.add("hidden");document.body.style.overflow=""}
function normalizeItem(item,type){return{id:item.id,type,title:item.title||item.name||"Untitled",poster_path:item.poster_path||null,vote_average:Number(item.vote_average||0),date:item.release_date||item.first_air_date||""}}
function toggleFavorite(item,opts={}){const key=`${item.type}-${item.id}`,i=state.favorites.findIndex(f=>`${f.type}-${f.id}`===key);if(i>=0){state.favorites.splice(i,1);showToast(`${item.title} removed from favorites.`)}else{state.favorites.unshift(item);showToast(`${item.title} added to favorites.`)}saveFavorites();updateFavoriteBadge();if(opts.refreshModal&&state.currentDetail)renderFavoriteButton(state.currentDetail.item,state.currentDetail.type);if(state.currentPage==="favorites")renderFavorites()}
function isFavoriteItem(item){return state.favorites.some(f=>f.type===item.type&&f.id===item.id)}
function renderFavorites(){const grid=document.getElementById("favoritesGrid"),empty=document.getElementById("favoritesEmpty"),status=document.getElementById("favoritesStatus");if(!state.favorites.length){grid.innerHTML="";empty.classList.remove("hidden");status.textContent="No saved titles";updateFavoriteBadge();return}empty.classList.add("hidden");grid.innerHTML="";state.favorites.forEach(item=>grid.appendChild(createCard(item,item.type)));status.textContent=`${state.favorites.length} saved title${state.favorites.length===1?"":"s"}`;updateFavoriteBadge()}
function updateFavoriteBadge(){const b=document.getElementById("favoriteBadge");if(!state.favorites.length){b.classList.add("hidden");return}b.textContent=state.favorites.length;b.classList.remove("hidden")}
function loadFavorites(){try{return JSON.parse(localStorage.getItem("cineXplore-favorites")||"[]")}catch{return[]}}
function saveFavorites(){localStorage.setItem("cineXplore-favorites",JSON.stringify(state.favorites))}
function skeletonCards(count){return Array.from({length:count},()=>`<div class="movie-card"><div class="poster-wrap" style="background:linear-gradient(110deg,#11161c,#1a2027,#11161c)"></div><div class="movie-info"><div style="height:12px;width:70%;background:#171d23;border-radius:3px"></div><div style="height:8px;width:45%;background:#12171c;border-radius:3px;margin-top:7px"></div></div></div>`).join("")}
function showInitialError(id,message){const grid=document.getElementById(id);if(grid)grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;min-height:260px"><div class="empty-icon">!</div><h3>Could not load content</h3><p>${escapeHtml(message)}</p></div>`}
let toastTimer=null;function showToast(message){const t=document.getElementById("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2800)}
function rating(v){return Number.isFinite(Number(v))?Number(v).toFixed(1):"—"}function year(d){return d?d.slice(0,4):"—"}function movieRuntime(m){if(!m)return"—";const h=Math.floor(m/60),min=m%60;return`${h}h ${min}m`}
function placeholderPoster(){return"https://placehold.co/500x750/11161c/8b929b?text=No+Poster"}function placeholderProfile(){return"https://placehold.co/185x278/11161c/8b929b?text=No+Photo"}function placeholderEpisode(){return"https://placehold.co/300x169/11161c/8b929b?text=No+Image"}function placeholderBackdrop(){return"https://placehold.co/1280x720/0d1115/8b929b?text=CineXplore"}
function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
