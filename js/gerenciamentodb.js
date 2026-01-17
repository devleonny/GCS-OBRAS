const nomeBaseCentral = 'GCS'
const nomeStore = 'Bases'

async function deletarDB(base, idInterno) {

    const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(nomeBaseCentral);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });

    if (!db.objectStoreNames.contains(nomeStore)) {
        db.close();
        return;
    }

    const tx = db.transaction(nomeStore, 'readwrite');
    const store = tx.objectStore(nomeStore);

    // Pega o objeto inteiro da base
    const registro = await new Promise((resolve, reject) => {
        const req = store.get(base);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });

    if (registro && registro.dados && registro.dados[idInterno]) {
        delete registro.dados[idInterno]; // remove o item interno

        // Salva de volta com o mesmo id
        await new Promise((resolve, reject) => {
            const putReq = store.put(registro);
            putReq.onsuccess = resolve;
            putReq.onerror = (e) => reject(e.target.error);
        });
    }

    await new Promise((resolve) => {
        tx.oncomplete = resolve;
    });

    db.close()
}

async function resetarTudo() {

    // Limpar variáveis;
    dados_clientes = {}
    dados_ocorrencias = {}
    listaOcorrencias = {}

    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBaseCentral)
        req.onsuccess = () => resolve(req.result)
        req.onerror = e => reject(e.target.error)
    })

    const stores = [...db.objectStoreNames]

    if (!stores.length) {
        db.close()
        return
    }

    const tx = db.transaction(stores, 'readwrite')

    for (const nomeStore of stores) {
        tx.objectStore(nomeStore).clear()
    }

    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
    })

    db.close()

}

async function inserirDados(dados, nomeBase, resetar) {

    const versao = await new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBaseCentral);
        req.onsuccess = () => {
            const db = req.result;
            const precisaCriar = !db.objectStoreNames.contains(nomeStore);
            const versaoAtual = db.version;
            db.close();
            resolve(precisaCriar ? versaoAtual + 1 : versaoAtual);
        };
        req.onerror = (e) => reject(e.target.error);
    });

    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBaseCentral, versao);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(nomeStore)) {
                db.createObjectStore(nomeStore, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });

    const tx = db.transaction(nomeStore, 'readwrite');
    const store = tx.objectStore(nomeStore);

    let dadosMesclados = {}

    if (!resetar) {

        const antigo = await new Promise((resolve, reject) => {
            const req = store.get(nomeBase);
            req.onsuccess = () => resolve(req.result?.dados || {});
            req.onerror = (e) => reject(e.target.error);
        });

        dadosMesclados = { ...antigo, ...dados };

    } else {
        dadosMesclados = dados
    }

    for (let [id, objeto] of Object.entries(dadosMesclados)) {
        if (objeto.excluido) {
            const trExistente = document.getElementById(id)
            if (trExistente) trExistente.remove()
            delete dadosMesclados[id]
        }
    }

    await store.put({ id: nomeBase, dados: dadosMesclados });

    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
    });

    db.close();
}

async function recuperarDados(nomeBase) {

    const getDadosPorBase = async (base) => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(nomeBaseCentral);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });

        if (!db.objectStoreNames.contains(nomeStore)) {
            return {};
        }

        const tx = db.transaction(nomeStore, 'readonly');
        const store = tx.objectStore(nomeStore);

        const item = await new Promise((resolve, reject) => {
            const req = store.get(base);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });

        db.close();

        return item?.dados || {};
    };

    return await getDadosPorBase(nomeBase);
}

async function recuperarDado(nomeBase, id) {
    const abrirDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(nomeBaseCentral);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    };

    const buscar = async (db, base, id) => {
        if (!db.objectStoreNames.contains(nomeStore)) return null;

        const tx = db.transaction(nomeStore, 'readonly');
        const store = tx.objectStore(nomeStore);

        const registro = await new Promise((resolve, reject) => {
            const req = store.get(base);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });

        return registro?.dados?.[id] || null;
    };

    const db = await abrirDB();
    let resultado = await buscar(db, nomeBase, id);

    db.close();
    return resultado;
}

async function sincronizarDados({ base, overlay = false, resetar = false, filtro = {} }) {

    if (overlay) overlayAguarde()
    if (base === 'hierarquia') resetar = true

    const local = resetar ? {} : await recuperarDados(base) || {}
    const nuvem = await receber(base) || {}

    let combinado = { ...local, ...nuvem }

    combinado = Object.fromEntries(
        Object.entries(combinado).filter(([_, obj]) => !obj?.excluido)
    )

    if (Object.keys(filtro).length) {
        combinado = Object.fromEntries(
            Object.entries(combinado).filter(([_, obj]) =>
                Object.entries(filtro).every(([campo, valor]) =>
                    obj?.[campo] === valor
                )
            )
        )
    }

    await inserirDados({}, base, true)
    await inserirDados(combinado, base)

    if (overlay) removerOverlay()

    return combinado
}

// SERVIÇO DE ARMAZENAMENTO 
async function receber(chave) {

    let chavePartes = chave.split('/')
    let dados = await recuperarDados(chavePartes[0]) || {}

    let timestamp = 0
    for (const [id, objeto] of Object.entries(dados)) {
        if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
    }

    const objeto = {
        chave: chave,
        timestamp: timestamp
    };

    const obs = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(objeto)
    };

    return new Promise((resolve, reject) => {
        fetch(`${api}/dados`, obs)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.mensagem) {
                    console.log(data.mensagem)
                    reject({})
                }
                resolve(data);
            })
            .catch(err => {
                resolve({})
            });
    })
}

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

    const acumulado = `
        <div class="msg-queda-conexao">
            <img src="gifs/alerta.gif" style="width: 2rem;">
            <span>${msg}</span>
        </div>
    `
    const msgAtiva = document.querySelector('.msg-queda-conexao')
    if (msgAtiva) return
    popup(acumulado, 'Alerta', true)
}