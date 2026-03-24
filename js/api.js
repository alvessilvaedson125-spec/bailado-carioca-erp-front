const API_URL = "https://bailado-carioca-escola-api.alvessilvaedson125.workers.dev"

async function apiRequest(endpoint, method = "GET", body = null) {

  const token = localStorage.getItem("token")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    signal: controller.signala
  }

  if (token) {
    options.headers["Authorization"] = "Bearer " + token
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  let response
  let data

  try {
    response = await fetch(API_URL + endpoint, options)
  } catch (error) {
    clearTimeout(timeout)
    throw new Error("Erro de conexão com a API")
  }

  clearTimeout(timeout)

  try {
    data = await response.json()
  } catch {
    throw new Error("Resposta inválida da API")
  }

  if (response.status === 401) {
  localStorage.removeItem("token")
  throw new Error("UNAUTHORIZED")
}

  if (!response.ok) {
    throw new Error(
      data?.message || `Erro ${response.status} na API`
    )
  }

  return data
}

async function fetchList(endpoint) {
  const res = await apiRequest(endpoint)

  if (!res.success) {
  throw new Error(res.message || "Erro ao carregar dados")
}

  return res.data || []
}