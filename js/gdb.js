const nomeBase = 'GCS v2'
const versao = 1

const stores = {
    dados_setores: { keyPath: 'usuario' },
    dados_orcamentos: { keyPath: 'id' },
}

function criarBases() {
    const request = indexedDB.open(nomeBase, versao)

    request.onupgradeneeded = e => {
        const db = e.target.result

        Object.entries(stores).forEach(([nome, config]) => {
            if (!db.objectStoreNames.contains(nome)) {
                db.createObjectStore(nome, config)
            }
        })
    }
}

function buscarDados({ base, chave }) {
    const request = indexedDB.open(nomeBase, versao)

    request.onsuccess = e => {

        const db = e.target.result
        const tx = db.transaction(base, 'readonly')
        const store = tx.objectStore(base)

        store.getAll().onsuccess = e => {
            console.log(e.target.result)
        }
    }
}

function inserirDadosv2(dados, base) {

    const request = indexedDB.open(nomeBase, versao)

    request.onsuccess = e => {

        const db = e.target.result
        const tx = db.transaction(base, 'readwrite')
        const store = tx.objectStore(base)

        store.put(dados)

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

function pesquisarUsuarios({ filtros = {}, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit
    let pulados = 0
    let coletados = 0
    const resultado = []

    const req = indexedDB.open('appDB', 1)

    req.onsuccess = e => {
        const db = e.target.result
        const tx = db.transaction('usuarios', 'readonly')
        const store = tx.objectStore('usuarios')

        store.openCursor().onsuccess = ev => {
            const cursor = ev.target.result
            if (!cursor) {
                console.log(resultado)
                return
            }

            const u = cursor.value

            // filtros
            if (
                (filtros.ativo === undefined || u.ativo === filtros.ativo) &&
                (filtros.status === undefined || u.status === filtros.status)
            ) {
                if (pulados < offset) {
                    pulados++
                } else if (coletados < limit) {
                    resultado.push(u)
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
