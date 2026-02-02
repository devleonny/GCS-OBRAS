const nomeBase = 'GCS v2'
const versao = 1

function criarBases(stores = null) {

    if (!stores)
        return

    const request = indexedDB.open(nomeBase, versao)

    request.onupgradeneeded = e => {
        const db = e.target.result

        Object.entries(stores).forEach(([nome, config]) => {
            if (!db.objectStoreNames.contains(nome)) {
                const store = db.createObjectStore(nome, config)

                store.createIndex(
                    'timestamp',
                    'timestamp',
                    { unique: false }
                )
            }
        })
    }
}

async function atualizarGCS(resetar) {

    if (emAtualizacao) return

    mostrarMenus(true)

    emAtualizacao = true
    sincronizarApp()

    const basesAuxiliares = {
        'informacoes': { keyPath: 'id' },
        'dados_setores': { keyPath: 'usuario' },
        'empresas': { keyPath: 'id' },
        'sistemas': { keyPath: 'id' },
        'prioridades': { keyPath: 'id' },
        'correcoes': { keyPath: 'id' },
        'tipos': { keyPath: 'id' },
        'veiculos': { keyPath: 'id' },
        'motoristas': { keyPath: 'id' },
        'dados_estoque': { keyPath: 'id' },
        'custo_veiculos': { keyPath: 'id' },
        'dados_composicoes': { keyPath: 'id' },
        'dados_clientes': { keyPath: 'id' },
        'dados_categorias_AC': { keyPath: 'id' },
        'dados_manutencao': { keyPath: 'id' },
        'dados_ocorrencias': { keyPath: 'id' },
        'dados_orcamentos': { keyPath: 'id' },
        'lista_pagamentos': { keyPath: 'id' },
        'tags_orcamentos': { keyPath: 'id' },
        'departamentos_AC': { keyPath: 'codigo' }
    }

    criarBases(basesAuxiliares)

    const status = { total: Object.keys(basesAuxiliares).length + 1, atual: 1 }

    sincronizarApp(status)

    status.atual++

    for (const base of Object.keys(basesAuxiliares)) {

        sincronizarApp(status)

        await sincronizarDados({ base, resetar })

        status.atual++

    }

    sincronizarApp({ remover: true })
    emAtualizacao = false
    await executar(funcaoTela)

}

async function sincronizarDados({ base, resetar = false }) {

    let timestamp = 0

    if (!resetar) {
        const request = indexedDB.open(nomeBase, versao)

        request.onupgradeneeded = e => {
            const db = e.target.result
            const tx = db.transaction(base)
            const store = tx.objectStore(base)
            const index = store.index('timestamp')

            index.openCursor(null, 'prev').onsuccess = e => {
                const c = e.target.result
                if (c) timestamp = c.value.timestamp
            }
        }
    }


    try {

        const response = await fetch(`${api}/dados`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chave: base, timestamp })
        })

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`)
        }

        const data = await response.json()

        if (data?.mensagem) {
            console.log(data.mensagem)
            return {}
        }

        return inserirDados(data, base)

    } catch (err) {
        console.log(err.message)
        return {}
    }

}

const regrasSnapshot = {
  dados_orcamentos: {
    snapshot: async ({ dado, stores }) => {

      const snap = {}

      // cliente
      const codCliente = dado?.dados_orcam?.omie_cliente
      if (codCliente) {
        const cliente = await getStore(stores.dados_clientes, codCliente)
        if (cliente) {
          snap.cliente = cliente.nome?.toLowerCase() || ''
          snap.cidade = cliente.cidade?.toLowerCase() || ''
        }
      }

      // responsável
      if (dado.usuario) {
        snap.responsavel = `${dado.usuario.toLowerCase()} ${Object.keys(dado?.usuarios || {}).map(u => u).join(' ')}`
      }

      // tags
      if (dado.tags) {
        const nomes = []
        for (const idTag of Object.keys(dado.tags)) {
          const tag = await getStore(stores.tags_orcamentos, idTag)
          if (tag?.nome) nomes.push(tag.nome.toLowerCase())
        }
        snap.tags = nomes
      }

      return snap
    }
  }
}

function getStore(store, key) {
  return new Promise(resolve => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

async function inserirDados(dados, base) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(nomeBase, versao)

    request.onerror = () => reject(request.error)

    request.onsuccess = async e => {
      const db = e.target.result

      const regra = regrasSnapshot[base]

      const storesExtras = regra
        ? ['dados_clientes', 'tags_orcamentos']
        : []

      const tx = db.transaction([base, ...new Set(storesExtras)], 'readwrite')
      const storePrincipal = tx.objectStore(base)

      const stores = {}
      for (const nome of storesExtras) {
        stores[nome] = tx.objectStore(nome)
      }

      tx.onerror = () => reject(tx.error)
      tx.oncomplete = () => resolve(true)

      for (const [id, d] of Object.entries(dados)) {
        if (d.excluido) {
          storePrincipal.delete(id)
          continue
        }

        if (regra?.snapshot) {
          d.snapshots = await regra.snapshot({
            dado: d,
            stores
          })
        }

        storePrincipal.put(d)
      }
    }
  })
}

function recuperarDado(base, chave) {
    return new Promise((resolve, reject) => {

        if (chave === undefined || chave === null) {
            resolve(null)
            return
        }

        const request = indexedDB.open(nomeBase, versao)

        request.onerror = () => reject(request.error)

        request.onsuccess = e => {
            const db = e.target.result
            const tx = db.transaction(base, 'readonly')
            const store = tx.objectStore(base)

            const req = store.get(chave)
            req.onsuccess = () => resolve(req.result ?? null)
            req.onerror = () => reject(req.error)
        }
    })
}

function pesquisarDB({ filtros = {}, base, pagina = 1, limite = 100 }) {
    return new Promise((resolve, reject) => {

        const offset = (pagina - 1) * limite
        let vistos = 0
        let total = 0
        const resultados = []

        const req = indexedDB.open(nomeBase, versao)

        req.onerror = () => reject(req.error)

        req.onsuccess = e => {
            const db = e.target.result
            const tx = db.transaction(base, 'readonly')
            const store = tx.objectStore(base)
            const index = store.index('timestamp')

            index.openCursor(null, 'prev').onsuccess = ev => {
                const cursor = ev.target.result
                if (!cursor) {
                    resolve({
                        resultados,
                        total,
                        paginas: Math.ceil(total / limite)
                    })
                    return
                }

                const reg = cursor.value

                if (passaFiltro(reg, filtros)) {
                    total++

                    if (vistos >= offset && resultados.length < limite) {
                        resultados.push(reg)
                    }
                    vistos++
                }

                cursor.continue()
            }
        }
    })
}

function getByPath(obj, path) {
    if (!path) return obj
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

function isVazio(v) {
    if (v === null || v === undefined) return true
    if (typeof v === 'string' && v.trim() === '') return true
    if (Array.isArray(v) && v.length === 0) return true
    if (typeof v === 'object' && Object.keys(v).length === 0) return true
    return false
}

function passaFiltro(reg, filtros) {
    for (const [path, regra] of Object.entries(filtros)) {
        const v = getByPath(reg, path)

        if (!regra) continue

        const { op, value } = regra

        switch (op) {
            case 'IS_EMPTY':
                if (!isVazio(v)) return false
                break

            case 'NOT_EMPTY':
                if (isVazio(v)) return false
                break

            case '=':
                if (v !== value) return false
                break

            case '!=':
                if (v === value) return false
                break

            case '>':
                if (!(v > value)) return false
                break

            case '>=':
                if (!(v >= value)) return false
                break

            case '<':
                if (!(v < value)) return false
                break

            case '<=':
                if (!(v <= value)) return false
                break

            case 'includes':
                if (!String(v).toLowerCase().includes(String(value).toLowerCase()))
                    return false
                break
        }
    }

    return true
}

function contarPorCampo({ base, path, filtros = {} }) {
    return new Promise((resolve, reject) => {

        const contagem = { todos: 0 }

        const req = indexedDB.open(nomeBase, versao)
        req.onerror = () => reject(req.error)

        req.onsuccess = e => {
            const db = e.target.result
            const tx = db.transaction(base, 'readonly')
            const store = tx.objectStore(base)

            store.openCursor().onsuccess = ev => {
                const cursor = ev.target.result
                if (!cursor) {
                    resolve(contagem)
                    return
                }

                const reg = cursor.value

                if (passaFiltro(reg, filtros)) {
                    let v = getByPath(reg, path)
                    if (v == undefined || v == null || v == '') {
                        v = 'EM BRANCO'
                    }

                    contagem.todos++
                    contagem[v] = (contagem[v] || 0) + 1

                }

                cursor.continue()
            }
        }
    })
}

function deletarDB(id, base) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBase)

        req.onerror = () => reject(req.error)

        req.onsuccess = e => {
            const db = e.target.result
            const tx = db.transaction(base, 'readwrite')
            const store = tx.objectStore(base)

            const del = store.delete(id)

            del.onsuccess = () => resolve(true)
            del.onerror = () => reject(del.error)

            tx.oncomplete = () => db.close()
        }
    })
}


// SERVIÇO DE ARMAZENAMENTO 
async function deletar(caminho, idEvento) {

    const url = `${api}/deletar`

    const objeto = {
        caminho,
        usuario: acesso.usuario
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        })

        if (!response.ok) {
            console.error(`Falha ao deletar: ${response.status} ${response.statusText}`)
            const erroServidor = await response.text()
            console.error(`Resposta do servidor:`, erroServidor)
            throw new Error(`Erro HTTP ${response.status}`)
        }

        const data = await response.json()

        if (idEvento) removerOffline('deletar', idEvento)

        return data
    } catch (erro) {
        console.error(`Erro ao tentar deletar '${caminho}':`, erro.message || erro)
        salvarOffline(objeto, 'deletar', idEvento)
        removerOverlay()
        return null
    }
}

function removerOffline(operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline'))
    delete dados_offline?.[operacao]?.[idEvento]
    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

async function enviar(caminho, info, idEvento) {
    const url = `${api}/salvar`
    const objeto = { caminho, valor: info };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            // Erro ao tentar interpretar como JSON;
            console.error("Resposta não é JSON válido:", parseError);
            salvarOffline(objeto, 'enviar', idEvento);
            return null;
        }

        if (!response.ok) {
            // Se a API respondeu erro (ex: 400, 500);
            console.error("Erro HTTP:", response.status, data);
            salvarOffline(objeto, 'enviar', idEvento);
            return null;
        }

        if (idEvento) removerOffline('enviar', idEvento);

        return data;
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        salvarOffline(objeto, 'enviar', idEvento);
        return null;
    }
}

function salvarOffline(objeto, operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    idEvento = idEvento || ID5digitos()

    if (!dados_offline[operacao]) dados_offline[operacao] = {}
    dados_offline[operacao][idEvento] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

function msgQuedaConexao(msg = '<b>Falha na atualização:</b> tente novamente em alguns minutos.') {

    const elemento = `
        <div class="msg-queda-conexao">
            <img src="gifs/alerta.gif" style="width: 2rem;">
            <span>${msg}</span>
        </div>
    `
    const msgAtiva = document.querySelector('.msg-queda-conexao')
    if (msgAtiva) return
    popup({ elemento })
}