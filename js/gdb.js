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

        // A tabela é a primeira: atualiza os dados da empresa atual antes da tabela de clientes;
        if (base == 'dados_setores') {
            const existente = obterPorID({ chave: 'usuario', base: 'dados_setores' })

            if (!existente) continue

            acesso = existente
            localStorage.setItem('acesso', JSON.stringify(existente))

        }

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
            body: JSON.stringify({ chave, timestamp })
        })

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`)
        }

        const data = await response.json()

        if (data?.mensagem) {
            console.log(data.mensagem)
            return {}
        }

        return inserirDados(data)

    } catch (err) {
        console.log(err.message)
        return {}
    }

}


function inserirDados(dados, base) {

    const request = indexedDB.open(nomeBase, versao)

    request.onsuccess = e => {

        const db = e.target.result
        const tx = db.transaction(base, 'readwrite')
        const store = tx.objectStore(base)

        for (const d of Object.values(dados)) {
            store.put(d)
        }

    }

}

function obterPorID({ chave, base }) {
    const request = indexedDB.open(nomeBase, versao)

    request.onsuccess = e => {
        const db = e.target.result
        const tx = db.transaction(base, 'readonly')
        const store = tx.objectStore(base)

        const req = store.get(chave)
        req.onsuccess = () => console.log(req.result)
    }
}

function pesquisarUsuarios({ filtros = {}, base, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit
    let pulados = 0
    let coletados = 0
    const resultado = []

    const req = indexedDB.open(nomeBase, versao)

    req.onsuccess = e => {
        const db = e.target.result
        const tx = db.transaction(base, 'readonly')
        const store = tx.objectStore(base)

        store.openCursor().onsuccess = ev => {
            const cursor = ev.target.result
            if (!cursor) {
                console.log(resultado)
                return
            }

            const reg = cursor.value

            if (passaFiltro(reg, filtros)) {
                if (pulados < offset) {
                    pulados++
                } else if (coletados < limit) {
                    resultado.push(reg)
                    coletados++
                }
            }

            if (coletados === limit) {
                console.log(resultado)
                return
            }

            cursor.continue()
        }
    }
}


function getByPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

function passaFiltro(reg, filtros) {
    return Object.entries(filtros).every(([path, regra]) => {
        const v = getByPath(reg, path)
        if (v === undefined) return false

        const { op, value } = regra

        switch (op) {
            case '=': return v === value
            case '!=': return v !== value
            case '>': return v > value
            case '>=': return v >= value
            case '<': return v < value
            case '<=': return v <= value
            case 'includes':
                return String(v).toLowerCase().includes(String(value).toLowerCase())
            default:
                return true
        }
    })
}
