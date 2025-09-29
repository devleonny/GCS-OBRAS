const tela = document.getElementById('tela')
const toolbar = document.querySelector('.toolbar')
const titulo = toolbar.querySelector('span')
const horizontal = `display: flex; align-items: center; justify-content: center;`
const vertical = `display: flex; align-items: start; justify-content: start; flex-direction: column`
const nomeBaseCentral = 'GCSMob'
const nomeStore = 'Bases'
let acesso = {}
const api = `https://api.gcs.app.br`
let progressCircle = null
let percentageText = null

function esquemaLinhas(base, id) {

    const esquema = {
        'dados_clientes': { colunas: ['nome', 'cnpj', 'cidade'], funcao: `gerenciarCliente('${id}')` },
        'dados_composicoes': { colunas: ['descricao', 'codigo', 'unidade', 'modelo', 'fabricante'], funcao: `` },
        'dados_setores': { colunas: ['nome_completo', 'empresa', 'setor', 'permissao'], funcao: `gerenciarUsuario('${id}')` },
        default: { colunas: ['nome'], funcao: `editarBaseAuxiliar('${base}', '${id}')` }
    }

    return esquema?.[base] || esquema.default
}
const modelo = (valor1, valor2) => `
        <div style="gap: 3px; display: flex; flex-direction: column; align-items: start; margin-bottom: 5px; width: 100%;">
            <label><strong>${valor1}</strong></label>
            <div style="width: 100%; text-align: left;">${valor2}</div>
        </div>
        `
const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: start; gap: 5px;">
        <label><b>${valor1}</b></label>
        <div style="text-align: justify; padding-right: 1vw;">${elemento}</div>
    </div>`
const botao = (texto, funcao, bgColor) => `<button style="background-color: ${bgColor}" onclick="${funcao}">${texto}</button>`
const botaoImg = (img, funcao) => `
    <div class="botaoImg">
        <img src="imagens/${img}.png" onclick="${funcao}">
    </div>
`
const dtFormatada = (data) => {
    if (!data) return '--'
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
}

const modeloTabela = ({ colunas, base, funcao }) => {

    const ths = colunas
        .map(col => `<th>${col}</th>`).join('')

    const thead = (colunas && colunas.length > 0) ? `<thead>${ths}</thead>` : ''

    const btnAtualizar = base
        ? `<img class="atualizar" src="imagens/atualizar.png" onclick="atualizarDados('${base}')">`
        : funcao
            ? `<img class="atualizar" src="imagens/atualizar.png" onclick="${funcao}">`
            : ''

    return `
    <div class="blocoTabela">
        <div class="painelBotoes">
            <div class="botoes">
                <div class="pesquisa">
                    <input oninput="pesquisar(this, 'body')" placeholder="Pesquisar" style="width: 100%;">
                    <img src="imagens/pesquisar2.png">
                </div>
            </div>
            ${btnAtualizar}
        </div>
        <div class="recorteTabela">
            <table class="tabela" ${colunas.length == 2 ? 'style="width: 100%;"' : ''}>
                ${thead}
                <tbody id="body"></tbody>
            </table>
        </div>
        <div class="rodapeTabela"></div>
    </div>`
}

const mensagem = (mensagem, imagem) => `
    <div class="mensagem">
        <img src="${imagem || 'gifs/alerta.gif'}">
        <label>${mensagem}</label>
    </div>
    `
const btnRodape = (texto, funcao) => `
    <button class="btnRodape" onclick="${funcao}">${texto}</button>
`
const btnPadrao = (texto, funcao) => `
        <span class="btnPadrao" onclick="${funcao}">${texto}</span>
`
const btn = ({ img, nome, funcao, id }) => `
    <div class="btnLateral" ${id ? `id="${id}"` : ''} onclick="${funcao}">
        <img src="imagens/${img}.png">
        <div>${nome}</div>
    </div>
`

document.addEventListener('keydown', function (event) {
    if (event.key === 'F5') f5()
})

function f5() {
    location.reload();
}

if (isAndroid) {

    document.addEventListener('deviceready', async () => {

        await solicitarPermissoes();

        connectWebSocket();
        telaLogin();

    }, false);

} else {

    connectWebSocket();
    telaLogin();

}

function solicitarPermissoes() {
    return new Promise((resolve, reject) => {
        if (!(cordova.plugins && cordova.plugins.permissions)) {
            popup(mensagem('Plugin de permissões não está disponível. Algumas funcionalidades podem não funcionar.'), 'Aviso');
            return resolve();
        }

        const permissions = cordova.plugins.permissions;
        const androidVersion = (device && device.version) || '0';
        const lista = [
            permissions.CAMERA,
            permissions.ACCESS_FINE_LOCATION,
            permissions.ACCESS_COARSE_LOCATION,
            permissions.FOREGROUND_SERVICE,
            permissions.FOREGROUND_SERVICE_LOCATION,
            ...(cordova.platformId === 'android' && parseFloat(androidVersion) >= 13
                ? [permissions.POST_NOTIFICATIONS]
                : [])
        ];

        permissions.requestPermissions(lista, (status) => {
            if (!status || typeof status.hasPermission === 'undefined') {
                popup(mensagem(`Falha ao verificar permissões. Verifique as configurações do dispositivo.`), 'Aviso');
                return reject(new Error('Verificação de permissões falhou'));
            }

            resolve();
        }, (error) => {
            popup(mensagem(`Erro ao solicitar permissões: ${error}`), 'Erro');
            reject(error);
        });
    });
}


function exibirSenha(img) {

    let inputSenha = img.previousElementSibling
    const atual = inputSenha.type == 'password'
    inputSenha.type = atual ? 'text' : 'password'
    img.src = `imagens/${atual ? 'olhoAberto' : 'olhoFechado'}.png`

}

function cadastrar() {

    const campos = ['Nome Completo', 'Usuário', 'Senha', 'E-mail', 'Telefone']

    const modelo = (texto) => `
        <div style="${vertical};">
            <span>${texto}</span>
            <input placeholder="${texto}">
        </div>
    `

    const acumulado = `
        <div class="camposCadastro">
            ${campos.map(campo => `${modelo(campo)}`).join('')}
            <hr style="width: 100%;">
            ${btnPadrao('Criar acesso', 'salvarCadastro()')}
        </div>
        `

    popup(acumulado, 'Cadastro')

}

async function capturarLocalizacao() {
    return new Promise((resolve) => {
        if (!("geolocation" in navigator)) {
            resolve(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                resolve(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0,
            }
        );
    });
}

function popup(elementoHTML, titulo, naoRemoverAnteriores) {

    const acumulado = `
        <div id="tempPop" class="overlay">

            <div class="janela_fora">
                
                <div class="toolbarPopup">

                    <span style="width: 90%;">${titulo || 'Popup'}</span>
                    <label style="width: 10%" onclick="removerPopup()">×</label>

                </div>
                
                <div class="janela">

                    ${elementoHTML}

                </div>

            </div>

        </div>`

    removerPopup(naoRemoverAnteriores)
    removerOverlay()
    document.body.insertAdjacentHTML('beforeend', acumulado);

}

async function removerPopup(naoRemoverAnteriores) {

    const popUps = document.querySelectorAll('#tempPop')

    if (naoRemoverAnteriores) return

    if (popUps.length > 1) {
        popUps[popUps.length - 1].remove()

    } else {
        popUps.forEach(pop => {
            pop.remove()
        })
    }

    const aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()

}

function removerOverlay() {
    let aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()
}

function overlayAguarde() {
    const aguarde = document.querySelector('.aguarde');
    if (aguarde) aguarde.remove();

    const elemento = `
        <div class="aguarde">
            <img src="gifs/loading.gif">
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', elemento);

    const style = document.createElement('style');
    style.innerHTML = `
        .aguarde {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        }

        .aguarde img {
            max-width: 100px;
        }
    `;
    document.head.appendChild(style);
}

const msgteste = (msg) => `
    <div style="background-color: #d2d2d2;">
        ${msg}
    </div>
`

function irGCS() {
    localStorage.setItem('app', 'GCS')
    window.location.href = '../index.html'
}

async function telaPrincipal() {
    acesso = JSON.parse(localStorage.getItem('acesso'));
    toolbar.style.display = 'flex';

    let menus = {
        'Atualizar': { img: 'atualizar', funcao: 'atualizarOcorrencias()', proibidos: [] },
        'Abertos': { id: 'abertos', img: 'configuracoes', funcao: 'telaOcorrencias(true)', proibidos: [] },
        'Solucionados': { id: 'solucionados', img: 'configuracoes', funcao: 'telaOcorrencias(false)', proibidos: [] },
        'Usuários': { img: 'perfil', funcao: 'telaUsuarios()', proibidos: ['user', 'técnico', 'analista', 'visitante'] },
        'Cadastros': { img: 'ajustar', funcao: 'telaCadastros()', proibidos: ['user', 'técnico', 'visitante'] },
        'Relatório': { img: 'kanban', funcao: 'telaRelatorio()', proibidos: ['user', 'técnico', 'visitante'] }
    };

    if (!isAndroid) {
        menus.GCS = { img: 'LG', funcao: 'irGCS()', proibidos: ['técnico', 'visitante'] }
    }

    menus.Desconectar = { img: 'sair', funcao: 'deslogar()', proibidos: [] }

    const stringMenus = Object.entries(menus)
        .filter(([_, dados]) => !dados.proibidos.includes(acesso.permissao))
        .map(([nome, dados]) => btn({ ...dados, nome }))
        .join('');

    const acumulado = `
        <div class="menu-container">
            <div class="side-menu" id="sideMenu">
                <div class="botoesMenu">
                    <div class="nomeUsuario">
                        <span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>
                    </div>
                    ${stringMenus}
                </div>
            </div>
            <div class="telaInterna">
                <div class="planoFundo">
                    <img src="imagens/BG.png">
                </div>
            </div>
        </div>
    `;

    tela.innerHTML = acumulado;

    await atualizarOcorrencias()
    if (acesso?.empresa == '') popup(mensagem('<b>Usuário sem empresa vinculada:</b> O relatório sairá sem dados.'), 'Sem empresa vinculada', true)
}

async function telaUsuarios() {

    mostrarMenus(false)
    overlayAguarde()

    titulo.textContent = 'Usuários'

    empresas = await recuperarDados('empresas')
    const colunas = ['Nome', 'Empresa', 'Setor', 'Permissão', '']
    const base = 'dados_setores'
    const dados = await recuperarDados(base)
    const telaInterna = document.querySelector('.telaInterna')
    telaInterna.innerHTML = modeloTabela({ colunas, base })

    for (let [id, objeto] of Object.entries(dados)) {
        criarLinha(objeto, id, base)
    }

    removerOverlay()

}

async function criarLinha(dados, id, nomeBase) {

    const modelo = (texto) => {
        return `
        <td>
            <div class="camposTd">
                <span>${texto}</span>
            </div>
        </td>`
    }

    let tds = ''
    if (nomeBase == 'dados_setores') {
        dados.empresa = empresas?.[dados?.empresa]?.nome || '...'
    }

    const esquema = esquemaLinhas(nomeBase, id)

    for (const linha of esquema.colunas) tds += modelo(dados?.[linha] || '--')

    const linha = `
        <tr id="${id}">
            ${tds}
            <td class="detalhes">
                <img onclick="${esquema.funcao}" src="imagens/pesquisar.png">
            </td>
        </tr>
    `

    const tr = document.getElementById(id)
    if (tr) return tr.innerHTML = linha
    const body = document.getElementById('body')
    body.insertAdjacentHTML('beforeend', linha)

}

function verificarClique(event) {
    const menu = document.getElementById('sideMenu');
    if (menu && menu.classList.contains('active') && !menu.contains(event.target)) menu.classList.remove('active')
}

async function sincronizarDados(base, overlayOff) {

    if (!overlayOff) overlayAguarde()

    let nuvem = await receber(base) || {}
    await inserirDados(nuvem, base)

    if (!overlayOff) removerOverlay()
}

async function atualizarDados(base) {

    overlayAguarde()
    if (base == 'dados_setores') {
        await sincronizarSetores()
    } else {
        await sincronizarDados(base)
    }

    // Mecânica para atualização/inclusão de linhas;
    const dados = await recuperarDados(base)
    for (const [id, objeto] of Object.entries(dados).reverse()) criarLinha(objeto, id, base)

    // Mecânica para remoção de linhas de dados excluídos;
    const chavesAtivas = Object.keys(dados)
    const tbody = document.getElementById('body')
    if (tbody) {
        const trs = tbody.querySelectorAll('tr')
        for (const tr of trs) {
            if (!chavesAtivas.includes(tr.id)) tr.remove()
        }
    }
    removerOverlay()

}

function popupNotificacao(msg) {

    const idNot = ID5digitos()
    const acumulado = `
        <div id="${idNot}" class="notificacao">${msg}</div>
    `

    document.body.insertAdjacentHTML('beforeend', acumulado)

    setTimeout(() => {
        document.getElementById(idNot).remove()
    }, 5000);

}

function deslogar() {

    const acumulado = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2vw;">
            <span>Tem certeza?</span>
            <button onclick="confirmarDeslogar()">Sim</button>
        </div>
    `
    popup(acumulado, 'Sair do GCS', true)
}

async function confirmarDeslogar() {
    removerPopup()
    localStorage.removeItem('acesso')
    telaLogin()
    await inserirDados({}, 'dados_ocorrencias', true) // resetar a base para o próximo usuário;
}

function mostrarMenus(operacao) {
    const menu = document.getElementById('sideMenu').classList
    if (operacao == 'toggle') return menu.toggle('active')
    operacao ? menu.add('active') : menu.remove('active')
}

async function gerenciarUsuario(id) {

    const usuario = await recuperarDado('dados_setores', id)

    const modelo = (texto, elemento) => `
        <div style="${vertical}; gap: 3px;">
            <span style="text-align: left;"><strong>${texto}</strong></span>
            <div>${elemento}</div>
        </div>
    `
    const empresasOpcoes = Object.entries({ '': { nome: '' }, ...empresas }).sort()
        .map(([id, empresa]) => `<option value="${id}" ${usuario?.empresa == id ? 'selected' : ''}>${empresa.nome}</option>`)
        .join('')

    const permissoes = ['', 'novo', 'desativado', 'técnico', 'visitante', 'analista', 'gerente']
        .map(op => `<option ${usuario?.permissao == op ? 'selected' : ''}>${op}</option>`).join('')

    const setores = ['', 'CHAMADOS', 'MATRIZ BA', 'INFRA', 'CHAMADO/INFRA', 'LOGÍSTICA']
        .map(op => `<option ${usuario?.setor == op ? 'selected' : ''}>${op}</option>`).join('')

    const acumulado = `
        <div style="${vertical}; gap: 5px; padding: 2vw; background-color: #d2d2d2;">
            ${modelo('Nome', usuario?.nome_completo || '--')}
            ${modelo('E-mail', usuario?.email || '--')}
            ${modelo('Permissão', `<select onchange="configuracoes('${id}', 'permissao', this.value)">${permissoes}</select>`)}
            ${modelo('Setor', `<select onchange="configuracoes('${id}', 'setor', this.value)">${setores}</select>`)}
            ${modelo('Empresa', `<select onchange="configuracoes('${id}', 'empresa', this.value)">${empresasOpcoes}</select>`)}
        </div>
    `

    popup(acumulado, 'Gerenciar Usuário')
}

function unicoID() {
    var d = new Date().getTime();
    if (window.performance && typeof window.performance.now === "function") {
        d += performance.now();
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

// API
setInterval(async function () {
    await reprocessarOffline()
}, 30 * 1000)

async function reprocessarOffline() {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};

    for (let [operacao, operacoes] of Object.entries(dados_offline)) {
        const ids = Object.keys(operacoes);

        for (let idEvento of ids) {
            const evento = operacoes[idEvento];

            if (operacao === 'enviar') {
                await enviar(evento.caminho, evento.valor, idEvento);
            } else if (operacao === 'deletar', idEvento) {
                await deletar(evento.chave, idEvento);
            }

        }
    }
}

function salvarOffline(objeto, operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    idEvento = idEvento || ID5digitos()

    if (!dados_offline[operacao]) dados_offline[operacao] = {}
    dados_offline[operacao][idEvento] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

function enviar(caminho, info, idEvento) {
    return new Promise((resolve) => {
        let objeto = {
            caminho: caminho,
            valor: info
        };

        fetch(`${api}/salvar-dados`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(data => {
                if (data.mensagem) {
                    msgQuedaConexao()
                    resolve()
                }
                resolve(data)
            })
            .catch((erro) => {
                salvarOffline(objeto, 'enviar', idEvento);
                resolve();
            });
    });
}

function msgQuedaConexao() {

    const acumulado = `
        <div class="msg-queda-conexao">
            <img src="gifs/alerta.gif" style="width: 2rem;">
            <span><b>Falha na atualização:</b> tente novamente em alguns minutos.</span>
        </div>
    `
    const msgAtiva = document.querySelector('.msg-queda-conexao')
    if (msgAtiva) return
    popup(acumulado, 'Alerta', true)
}

async function receber(chave) {

    const chavePartes = chave.split('/')
    const dados = await recuperarDados(chavePartes[0]) || {}
    let timestamp = 0

    for (const [id, objeto] of Object.entries(dados)) {
        if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
    }

    const rota = chavePartes[0] == 'dados_clientes' ? 'clientes-validos' : 'obter-dados'
    const obs = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chave: chave,
            timestamp: timestamp
        })
    };

    return new Promise((resolve, reject) => {
        fetch(`${api}/${rota}`, obs)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.mensagem) {
                    msgQuedaConexao()
                    resolve({})
                }
                resolve(data);
            })
            .catch(err => {
                msgQuedaConexao()

                sincronizarApp({ remover: true })
                emAtualizacao = false

                resolve({})
            });
    })
}

async function deletar(chave, idEvento) {
    const url = `${api}/deletar-dados`;
    const objeto = {
        chave,
        usuario: acesso.usuario
    }

    return new Promise((resolve) => {
        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch((err) => {
                salvarOffline(objeto, 'deletar', idEvento);
                popup(mensagem(err), 'Aviso', true)
                resolve();
            });
    });
}

async function configuracoes(usuario, campo, valor) {

    let dadosUsuario = await recuperarDado('dados_setores', usuario)
    dadosUsuario[campo] = valor

    await inserirDados({ [usuario]: dadosUsuario }, 'dados_setores')

    if (campo == 'empresa') {
        dadosUsuario[campo] = empresas?.[valor]?.nome || ''
    }

    if (campo == 'permissao' && valor == 'desativado') {
        const tr = document.getElementById(usuario)
        if (tr) tr.remove()

    } else {
        criarLinha(dadosUsuario, usuario, 'dados_setores')
    }

    return new Promise((resolve, reject) => {
        fetch(`${api}/configuracoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, campo, valor })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.mensagem(err)
                reject()
            });
    })
}

async function sincronizarSetores(overflow) {

    if (!overflow) overlayAguarde()

    dados_setores = await recuperarDados('dados_setores')

    let timestamp = 0
    for (const [usuario, objeto] of Object.entries(dados_setores)) {

        if (objeto.permissao == 'desativado') {
            timestamp = 0
            break
        }

        if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
    }

    let nuvem = await listaSetores(timestamp)

    if (nuvem[acesso.usuario]) {
        await inserirDados({}, 'dados_ocorrencias')
        acesso = nuvem[acesso.usuario]
        localStorage.setItem('acesso', JSON.stringify(nuvem[acesso.usuario]))
    }

    await inserirDados(nuvem, 'dados_setores', timestamp == 0)
    dados_setores = await recuperarDados('dados_setores')

    removerOverlay()

}

async function listaSetores(timestamp) {
    try {
        const response = await fetch(`${api}/setores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp })
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch {
        return {}
    }
}

function pesquisar(input, idTbody) {
    const termo = input.value.trim().toLowerCase();
    const tbody = document.getElementById(idTbody);
    const trs = tbody.querySelectorAll('tr');

    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        let encontrou = false;

        tds.forEach(td => {
            let texto = td.textContent.trim().toLowerCase();

            const inputInterno = td.querySelector('input, textarea, select');
            if (inputInterno) {
                texto += ' ' + inputInterno.value.trim().toLowerCase();
            }

            if (termo && texto.includes(termo)) {
                encontrou = true;
            }
        });

        if (!termo || encontrou) {
            tr.style.display = ''; // mostra
        } else {
            tr.style.display = 'none'; // oculta
        }
    });
}

function conversor(stringMonetario) {
    if (typeof stringMonetario === 'number') {
        return stringMonetario;
    } else if (!stringMonetario || stringMonetario.trim() === "") {
        return 0;
    } else {
        stringMonetario = stringMonetario.trim();
        stringMonetario = stringMonetario.replace(/[^\d,]/g, '');
        stringMonetario = stringMonetario.replace(',', '.');
        var valorNumerico = parseFloat(stringMonetario);

        if (isNaN(valorNumerico)) {
            return 0;
        }

        return valorNumerico;
    }
}

function ID5digitos() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        id += caracteres.charAt(indiceAleatorio);
    }
    return id;
}

function base64ToBlob(base64) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

async function importarAnexos({ input, foto }) {
    const formData = new FormData();

    if (foto) {
        const blob = base64ToBlob(foto);
        formData.append('arquivos', blob);
    } else {
        for (const file of input.files) {
            formData.append('arquivos', file);
        }
    }

    try {
        const response = await fetch(`${api}/upload/GCS`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (err) {
        popup(mensagem(`Erro na API: ${err}`));
        throw err;
    }
}

function criarAnexoVisual({ nome, link, funcao }) {

    let displayExcluir = 'flex'

    if (!funcao) displayExcluir = 'none'

    return `
        <div class="contornoAnexos" name="${link}">
            <div onclick="abrirArquivo('${link}', '${nome}')" class="contornoInterno">
                <img src="imagens/anexo2.png">
                <label title="${nome}">${nome}</label>
            </div>
            <img src="imagens/cancel.png" style="display: ${displayExcluir};" onclick="${funcao}">
        </div>
    `
}

function abrirArquivo(link, nome) {
    link = `${api}/uploads/GCS/${link}`;
    const imagens = ['png', 'jpg', 'jpeg'];

    const extensao = nome.split('.').pop().toLowerCase(); // pega sem o ponto

    if (imagens.includes(extensao)) {
        const acumulado = `
            <div class="fundoImagens">
                <img src="${link}" style="width: 100%;">
            </div>
        `
        return popup(acumulado, nome, true);
    }

    window.open(link, '_blank');
}

async function cxOpcoes(name, nomeBase, funcaoAux) {

    const campos = nomeBase == 'dados_setores' ? ['nome_completo', 'setor'] : esquemaLinhas(nomeBase).colunas
    const base = await recuperarDados(nomeBase)
    let opcoesDiv = ''

    for ([cod, dado] of Object.entries(base)) {

        const labels = campos
            .map(campo => `${(dado[campo] && dado[campo] !== '') ? `<label>${dado[campo]}</label>` : ''}`)
            .join('')

        const valorSeguro = (dado[campos[0]] || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n|\r/g, "\\n");

        opcoesDiv += `
            <div name="camposOpcoes" class="atalhos" onclick="selecionar('${name}', '${cod}', '${valorSeguro}' ${funcaoAux ? `, '${funcaoAux}'` : ''})">
                ${labels}
            </div>`
    }

    const acumulado = `
        <div style="${horizontal}; justify-content: left; background-color: #b1b1b1;">

            <div class="pesquisa">
                <input oninput="pesquisarCX(this)" placeholder="Pesquisar" style="width: 100%;">
                <img src="imagens/pesquisar2.png">
            </div>

        </div>
        <div class="gavetaOpcoes">
            ${opcoesDiv}
        </div>
        <div class="rodapeTabela"></div>
    `

    popup(acumulado, 'Selecione o item', true)

}

async function selecionar(name, id, termo, funcaoAux) {
    const elemento = document.querySelector(`[name='${name}']`)
    elemento.textContent = termo
    elemento.id = id
    removerPopup()

    if (funcaoAux) await eval(funcaoAux)
}

function pesquisarCX(input) {

    const termoPesquisa = String(input.value).toLowerCase()

    const divs = document.querySelectorAll(`[name='camposOpcoes']`)

    for (const div of divs) {

        const termoDiv = String(div.textContent).toLocaleLowerCase()

        div.style.display = (termoDiv.includes(termoPesquisa) || termoPesquisa == '') ? '' : 'none'

    }

}

async function mobi7({ base, usuarioMobi7, dtInicial, dtFinal }) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/mobi7`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base, usuarioMobi7, dtInicial, dtFinal })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(error => reject(error));

    })
}

function inicialMaiuscula(string) {
    if (string == undefined) {
        return ''
    }
    string.includes('_') ? string = string.split('_').join(' ') : ''

    if (string.includes('lpu')) return string.toUpperCase()
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}