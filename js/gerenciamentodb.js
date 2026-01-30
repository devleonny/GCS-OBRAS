const nomeBaseCentral = 'GCS'
const nomeStore = 'Bases'

async function resetarTudo() {

    // Limpar variáveis;
    db = {}

    const dbGCS = await new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBaseCentral)
        req.onsuccess = () => resolve(req.result)
        req.onerror = e => reject(e.target.error)
    })

    const stores = [...dbGCS.objectStoreNames]

    if (!stores.length) {
        dbGCS.close()
        return
    }

    const tx = dbGCS.transaction(stores, 'readwrite')

    for (const nomeStore of stores) {
        tx.objectStore(nomeStore).clear()
    }

    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
    })

    dbGCS.close()

}

function comparar(valorAtual, valorFiltro) {
    if (typeof valorFiltro === 'string') {
        if (valorFiltro.startsWith('!~'))
            return !String(valorAtual ?? '').includes(valorFiltro.slice(2))

        if (valorFiltro.startsWith('!'))
            return valorAtual !== valorFiltro.slice(1)

        if (valorFiltro.startsWith('~'))
            return String(valorAtual ?? '').includes(valorFiltro.slice(1))
    }

    return valorAtual === valorFiltro
}

function buscarCampo(obj, campo, valorFiltro, negativo = false) {
    if (!obj || typeof obj !== 'object') return negativo

    if (campo in obj) {
        const ok = comparar(obj[campo], valorFiltro)
        return negativo ? !ok : ok
    }

    return Object.values(obj).some(v =>
        buscarCampo(v, campo, valorFiltro, negativo)
    )
}

function contemCampoValor(obj, campo, valorFiltro) {
    const negativo =
        typeof valorFiltro === 'string' && valorFiltro.startsWith('!')

    if (negativo) {
        return !buscarCampo(obj, campo, valorFiltro.slice(1), false)
    }

    return buscarCampo(obj, campo, valorFiltro, false)
}

