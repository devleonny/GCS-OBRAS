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
