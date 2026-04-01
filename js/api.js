const API_URL = "https://bailado-carioca-escola-api.alvessilvaedson125.workers.dev"

// ===============================
// REFRESH TOKEN
// ===============================

let isRefreshing = false;
let refreshQueue = [];

async function tryRefreshToken(){
  if(isRefreshing){
    // Aguarda o refresh em andamento
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try{
    const token = localStorage.getItem("token");
    if(!token) throw new Error("No token");

    const response = await fetch(API_URL + "/api/v1/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      }
    });

    const data = await response.json();

    if(!response.ok || !data.success || !data.token){
      throw new Error("Refresh failed");
    }

    // Salva novo token
    localStorage.setItem("token", data.token);
    if(data.user?.role) localStorage.setItem("user_role", data.user.role);

    // Resolve todos na fila
    refreshQueue.forEach(p => p.resolve(data.token));
    refreshQueue = [];

    return data.token;

  }catch(err){
    // Refresh falhou — desloga com mensagem
    refreshQueue.forEach(p => p.reject(err));
    refreshQueue = [];

    localStorage.removeItem("token");
    localStorage.removeItem("user_role");

    Toast.warning("Sessão expirada. Faça login novamente.");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);

    throw err;

  }finally{
    isRefreshing = false;
  }
}

// ===============================
// API REQUEST
// ===============================

async function apiRequest(endpoint, method = "GET", body = null){

  const token = localStorage.getItem("token");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    signal: controller.signal
  };

  if(token){
    options.headers["Authorization"] = "Bearer " + token;
  }

  if(body){
    options.body = JSON.stringify(body);
  }

  let response;
  let data;

  try{
    response = await fetch(API_URL + endpoint, options);
  }catch(error){
    clearTimeout(timeout);
    throw new Error("Erro de conexão com a API");
  }

  clearTimeout(timeout);

  // 🔥 Token expirado — tenta refresh automático
  if(response.status === 401){
    try{
      await tryRefreshToken();

      // Refaz a requisição com o novo token
      const newToken = localStorage.getItem("token");
      const retryOptions = {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + newToken
        }
      };
      if(body) retryOptions.body = JSON.stringify(body);

      const retryResponse = await fetch(API_URL + endpoint, retryOptions);
      data = await retryResponse.json();
      return data;

    }catch(err){
      throw new Error("UNAUTHORIZED");
    }
  }

  try{
    data = await response.json();
  }catch{
    throw new Error("Resposta inválida da API");
  }

  if(!response.ok){
    throw new Error(data?.message || `Erro ${response.status} na API`);
  }

  return data;
}

async function fetchList(endpoint){
  const res = await apiRequest(endpoint);
  if(!res.success){
    throw new Error(res.message || "Erro ao carregar dados");
  }
  return res.data || [];
}