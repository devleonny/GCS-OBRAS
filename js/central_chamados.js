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
let telaInterna = null
let filtrosPagina = {}
let pExecucao = true
const extensoes = ['jpg', 'jpeg', 'png']

document.addEventListener('keydown', function (event) {
    if (event.key === 'F8') resetarBases()
    if (event.key === 'F5') location.reload()
})

async function resetarBases() {

    overlayAguarde(true)

    const divMensagem = document.querySelector('.div-mensagem')

    divMensagem.innerHTML = `
        <div style="${vertical}; gap: 1vh;">
            <label><b>GCS</b>: Por favor, aguarde...</label>
            <br>
            <div id="logs" style="${vertical}; gap: 1vh;"></div>
        </div>
    `

    const logs = document.getElementById('logs')

    logs.insertAdjacentHTML('beforeend', '<label>Criando uma nova Base, 0km, novíssima...</label>')

    const bases = [
        'dados_clientes',
        'prioridades',
        'tipos',
        'correcoes',
        'sistemas',
        'empresas',
        'dados_setores'
    ]

    for (const base of bases) {
        await sincronizarDados(base, true, true) // Nome base, overlay off e resetar bases;
        logs.insertAdjacentHTML('beforeend', `<label>Sincronizando: ${base}</label>`)
    }

    telaPrincipal()
    removerOverlay()

}

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
    <div style="${horizontal}; gap: 1rem; margin-bottom: 5px; width: 100%;">
        <label style="width: 30%; text-align: right;"><b>${valor1}</b></label>
        <div style="width: 70%; text-align: left;">${valor2}</div>
    </div>`

const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: start; gap: 5px;">
        <label><b>${valor1}:</b></label>
        <div style="text-align: justify;">${elemento}</div>
    </div>`

const botao = (texto, funcao, bgColor) => `<button style="background-color: ${bgColor}" onclick="${funcao}">${texto}</button>`

const botaoImg = (img, funcao) => `
    <div class="botaoImg">
        <img src="imagens/${img}.png" onclick="${funcao}">
    </div>`

const dtFormatada = (data) => {
    if (!data) return '-'
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
}

const modeloTabela = ({ minWidth, removerPesquisa = false, colunas, base, funcao, btnExtras = '', body = 'body' }) => {

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const tPesquisa = colunas
        .map((col, i) => `<th style="text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, '${body}')"></th>`)
        .join('')

    const btnAtualizar = base
        ? `<img class="atualizar" src="imagens/atualizar.png" onclick="atualizarDados('${base}')">`
        : funcao
            ? `<img class="atualizar" src="imagens/atualizar.png" onclick="${funcao}">`
            : ''

    return `
    <div class="blocoTabela" ${minWidth ? `style="min-width: ${minWidth}"` : ''}>
        <div class="painelBotoes">
            <div class="botoes">
                ${btnExtras}
            </div>
            ${btnAtualizar}
        </div>
        <div class="recorteTabela">
            <table class="tabela" ${colunas.length == 2 ? 'style="width: 100%;"' : ''}>
                <thead>
                    <tr>${ths}</tr>
                    ${removerPesquisa ? '' : `<tr>${tPesquisa}</tr>`}
                </thead>
                <tbody id="${body}"></tbody>
            </table>
        </div>
        <div class="rodape-tabela"></div>
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
const btn = ({ img, nome, funcao, id, elemento }) => `
    <div class="btnLateral" ${id ? `id="${id}"` : ''} onclick="${funcao}">
        ${img ? `<img src="imagens/${img}.png">` : ''}
        ${elemento || ''}
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

    connectWebSocket()
    telaLogin()

}

function pesquisarGenerico(coluna, texto, tbody = 'body') {

    filtrosPagina[tbody] ??= {}
    filtrosPagina[tbody][coluna] = String(texto).toLowerCase().replace(/\./g, '').trim()

    const trs = document.querySelectorAll(`#${tbody} tr`)

    // pega todo o conteúdo útil da td (inputs, selects, textos)
    function extrairTexto(td) {
        let partes = []

        // pega textos diretos
        partes.push(td.textContent || '')

        // inputs
        td.querySelectorAll('input').forEach(inp => {
            partes.push(inp.value || '')
        })

        // textareas
        td.querySelectorAll('textarea').forEach(tx => {
            partes.push(tx.value || '')
        })

        // selects
        td.querySelectorAll('select').forEach(sel => {
            let opt = sel.options[sel.selectedIndex]
            partes.push(opt ? opt.text : sel.value)
        })

        // join e normaliza
        return partes.join(' ').replace(/\s+/g, ' ').trim()
    }

    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td')
        let mostrar = true

        const filtros = filtrosPagina[tbody]

        for (const [col, filtroTexto] of Object.entries(filtros)) {

            if (!filtroTexto) continue

            if (col >= tds.length) {
                mostrar = false
                break
            }

            const conteudoTd = extrairTexto(tds[col]).toLowerCase().replace(/\./g, '').trim()

            if (!conteudoTd.includes(filtroTexto)) {
                mostrar = false
                break
            }
        }

        tr.style.display = mostrar ? '' : 'none'
    })

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

    const inputSenha = img.previousElementSibling
    const atual = inputSenha.type == 'password'
    inputSenha.type = atual ? 'text' : 'password'
    img.src = `imagens/${atual ? 'olhoAberto' : 'olhoFechado'}.png`

}

async function capturarLocalizacao() {
    return new Promise(resolve => {
        if (!('geolocation' in navigator)) {
            localStorage.setItem('geo_permitido', '0')
            return resolve(null)
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                localStorage.setItem('geo_permitido', '1')
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                })
            },
            () => {
                localStorage.setItem('geo_permitido', '0')
                resolve(null)
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        )
    })
}

function popup(elementoHTML, titulo, naoRemoverAnteriores) {

    const acumulado = `
        <div id="tempPop" class="overlay">

            <div class="janela-fora">
                
                <div class="toolbarPopup">

                    <div class="title">${titulo || 'Popup'}</div>
                    <span class="close" onclick="removerPopup()">×</span>

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

    const aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()

    const elemento = `
        <div class="aguarde">
            <div class="div-mensagem"></div>
            <img src="gifs/loading.gif">
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', elemento)

    let pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );

    document.querySelector('.aguarde').style.height = `${pageHeight}px`;

}

function irGCS() {
    localStorage.setItem('app', 'GCS')
    window.location.href = 'index.html'
}

async function telaPrincipal() {

    toolbar.style.display = 'flex'
    const planoFundo = `
        <div class="planoFundo">
            <img src="gifs/loading.gif" style="width: 8rem;">
        </div>`

    const acumulado = `
        <div class="menu-container">
            <div class="side-menu" id="sideMenu">
                <div class="progresso"></div>
                <div class="botoesMenu"></div>
            </div>
            <div class="telaInterna">
                ${planoFundo}
            </div>
        </div>
    `

    telaInterna = document.querySelector('.telaInterna')
    if (!telaInterna) tela.innerHTML = acumulado

    telaInterna = document.querySelector('.telaInterna')
    telaInterna.innerHTML = planoFundo

    mostrarMenus(false)

    if (pExecucao) {
        mostrarMenus(true)
        carregarMenus()
        pExecucao = false
        await atualizarOcorrencias()
        // Após atualização;
        acesso = await recuperarDado('dados_setores', acesso.usuario) || {}
        // Recuperar Filtros;
        filtrosAtivos = JSON.parse(localStorage.getItem('filtrosAtivos')) || {}
    }


}

function carregarMenus() {

    const blq = ['cliente', 'técnico']

    const menus = {
        'Atualizar': { img: 'atualizar', funcao: 'atualizarOcorrencias()', proibidos: [] },
        'Início': { img: 'home', funcao: 'telaPrincipal()', proibidos: [] },
        'Criar Ocorrência': { img: 'baixar', funcao: 'formularioOcorrencia()', proibidos: [] },
        'Ocorrências': { img: 'configuracoes', funcao: 'telaOcorrencias()', proibidos: [] },
        'Relatório de Ocorrências': { img: 'planilha', funcao: 'telaRelatorio()', proibidos: ['user', 'técnico', 'visitante'] },
        'Relatório de Correções': { img: 'planilha', funcao: 'telaRelatorioCorrecoes()', proibidos: ['user', 'técnico', 'visitante'] },
        'Usuários': { img: 'perfil', funcao: 'telaUsuarios()', proibidos: ['user', 'cliente', 'técnico', 'analista', 'visitante'] },
        'Cadastros': { img: 'ajustar', funcao: 'telaCadastros()', proibidos: ['user', 'técnico', 'cliente', 'visitante'] },
    }

    if (!blq.includes(acesso.permissao)) {
        menus.GCS = { img: 'LG', funcao: 'irGCS()', proibidos: ['técnico', 'visitante'] }
    }

    menus.Desconectar = { img: 'sair', funcao: 'deslogar()', proibidos: [] }

    const stringMenus = Object.entries(menus)
        .filter(([_, dados]) => !dados.proibidos.includes(acesso.permissao))
        .map(([nome, dados]) => btn({ ...dados, nome }))
        .join('');

    const botoes = `
        <div class="nomeUsuario">
            <span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>
        </div>
        <br>
        <div class="painel-pendencias"></div>
        <br>
        ${stringMenus}

    `
    document.querySelector('.botoesMenu').innerHTML = botoes
}

async function telaUsuarios() {

    filtroOcorrencias = {}

    overlayAguarde()

    titulo.textContent = 'Gerenciar Usuários'

    mostrarMenus(false)

    empresas = await recuperarDados('empresas')
    const colunas = ['Nome', 'Empresa', 'Setor', 'Permissão', '']

    const dados_setores = await recuperarDados('dados_setores')
    const btnExtras = `<img onclick="atualizarUsuarios()" src="imagens/atualizar.png">`

    const tbody = document.getElementById('tabela_usuarios')
    if (!tbody) telaInterna.innerHTML = modeloTabela({ btnExtras, colunas, body: 'tabela_usuarios' })

    for (const [user, dados] of Object.entries(dados_setores)) {
        criarLinhaUsuario(user, dados)
    }

    removerOverlay()

}

async function atualizarUsuarios() {

    await sincronizarDados('dados_setores')
    await sincronizarDados('empresas')
    await telaUsuarios()

}

function criarLinhaUsuario(user, dados) {

    const tds = `
        <td>${dados.nome_completo || '...'}</td>
        <td>${empresas?.[dados?.empresa]?.nome || '...'}</td>
        <td>${dados.setor || '...'}</td>
        <td>${dados.permissao || '...'}</td>
        <td><img onclick="gerenciarUsuario('${user}')" src="imagens/pesquisar.png"></td>
    `

    const trExistente = document.getElementById(user)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('tabela_usuarios').insertAdjacentHTML('beforeend', `<tr id="${user}">${tds}</tr>`)
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

    const esquema = esquemaLinhas(nomeBase, id)

    for (const linha of esquema.colunas) tds += modelo(dados?.[linha] || '...')

    const linha = `
        ${tds}
        <td class="detalhes">
            <img onclick="${esquema.funcao}" src="imagens/pesquisar.png">
        </td>
    `

    const tr = document.getElementById(id)
    if (tr) return tr.innerHTML = linha
    const body = document.getElementById('body')
    body.insertAdjacentHTML('beforeend', `<tr id="${id}">${linha}</tr>`)

}

function verificarClique(event) {
    const menu = document.getElementById('sideMenu');
    if (menu && menu.classList.contains('active') && !menu.contains(event.target)) menu.classList.remove('active')
}

async function sincronizarDados(base, overlayOff, reset) {

    if (!overlayOff) overlayAguarde()

    if (reset) await inserirDados({}, base, true)
    const nuvem = await receber(base) || {}
    await inserirDados(nuvem, base)

    if (!overlayOff) removerOverlay()
}

async function atualizarDados(base) {

    overlayAguarde()

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
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 1rem;">
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

    const empresasOpcoes = Object.entries({ '': { nome: '' }, ...empresas }).sort()
        .map(([id, empresa]) => `<option value="${id}" ${usuario?.empresa == id ? 'selected' : ''}>${empresa.nome}</option>`)
        .join('')

    const permissoes = ['novo', 'desativado', 'técnico', 'cliente']
        .map(op => `<option ${usuario?.permissao == op ? 'selected' : ''}>${op}</option>`).join('')

    const setores = ['', 'CHAMADOS', 'MATRIZ BA', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO']
        .map(op => `<option ${usuario?.setor == op ? 'selected' : ''}>${op}</option>`).join('')

    const linhas = [
        { texto: 'Nome', elemento: `<span>${usuario?.nome_completo || '-'}</span>` },
        { texto: 'E-mail', elemento: `<span>${usuario?.email || '-'}</span>` },
        { texto: 'Permissão', elemento: `<select onchange="configuracoes('${id}', 'permissao', this.value)">${permissoes}</select>` },
        { texto: 'Setor', elemento: `<select onchange="configuracoes('${id}', 'setor', this.value)">${setores}</select>` },
        { texto: 'Empresa', elemento: `<select onchange="configuracoes('${id}', 'empresa', this.value)">${empresasOpcoes}</select>` }
    ]

    const form = new formulario({ linhas, titulo: 'Gerenciar Usuário' })
    form.abrirFormulario()

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

function removerOffline(operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline'))
    delete dados_offline?.[operacao]?.[idEvento]
    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

function salvarOffline(objeto, operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    idEvento = idEvento || ID5digitos()

    if (!dados_offline[operacao]) dados_offline[operacao] = {}
    dados_offline[operacao][idEvento] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

async function enviar(caminho, info, idEvento) {
    return new Promise((resolve, reject) => {
        const objeto = { caminho, valor: info }

        fetch(`${api}/salvar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        })
            .then(res => res.json())
            .then(data => {
                if (data.mensagem) {
                    msgQuedaConexao()
                    return resolve(data) // Só um resolve, com retorno;
                }
                resolve(data)
            })
            .catch(err => {
                if (caminho.includes('0000')) {
                    return reject({ mensagem: 'Sem conexão rede/servidor, tente novamente em alguns minutos' })
                }
                salvarOffline(objeto, 'enviar', idEvento)
                resolve({ mensagem: 'Offline' }) // Retorna algo definido;
            })
    })
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

async function receber(chave, reset = false) {

    const chavePartes = chave.split('/')
    const dados = await recuperarDados(chavePartes[0]) || {}
    let timestamp = 0

    if (!reset) {
        for (const [, objeto] of Object.entries(dados)) {
            if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
        }
    }

    const rota = chavePartes[0] == 'dados_clientes' ? 'clientes-validos' : 'dados'
    const obs = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chave,
            usuario: acesso.usuario,
            timestamp
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
                    msgQuedaConexao(data.mensagem)
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

async function deletar(caminho, idEvento) {
    const url = `${api}/deletar`

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caminho, usuario: acesso.usuario })
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("Resposta não é JSON válido:", parseError);
            salvarOffline(objeto, 'deletar', idEvento);
            return null;
        }

        if (!response.ok) {
            console.error("Erro HTTP:", response.status, data);
            salvarOffline(objeto, 'deletar', idEvento);
            return null;
        }

        if (idEvento) removerOffline('deletar', idEvento);

        return data;
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        salvarOffline(objeto, 'deletar', idEvento);
        return null;
    }
}

async function configuracoes(usuario, campo, valor) {

    const resposta = comunicacaoServ({ usuario, campo, valor })

    if (resposta.mensagem) return popup(mensagem(resposta.mensagem), 'Alerta', true)

    const dadosUsuario = await recuperarDado('dados_setores', usuario)
    dadosUsuario[campo] = valor

    if (campo == 'permissao' && valor == 'desativado') {
        removerPopup()
        await deletarDB('dados_setores', usuario)
        const tr = document.getElementById(usuario)
        if (tr) tr.remove()
    } else {
        await inserirDados({ [usuario]: dadosUsuario }, 'dados_setores')
        await telaUsuarios()
    }
}

async function comunicacaoServ({ usuario, campo, valor }) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/configuracoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, campo, valor })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)
                }
                return response.json()
            })
            .then(data => {
                resolve(data)
            })
            .catch(err => {
                reject({ mensagem: err })
            })
    })
}

function pesquisar(input) {
    const termo = input.value.trim().toLowerCase();
    const tbody = document.querySelector('.tabela tbody');
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
        const response = await fetch(`${api}/upload`, {
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
                <label title="${nome}">${nome.slice(0, 15)}...</label>
            </div>
            <img src="imagens/cancel.png" style="display: ${displayExcluir};" onclick="${funcao}">
        </div>
    `
}

function abrirArquivo(link, nome) {
    link = `${api}/uploads/${link}`;
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

    const campos = nomeBase === 'dados_setores'
        ? ['nome_completo', 'setor']
        : esquemaLinhas(nomeBase).colunas

    const base = Object.entries(await recuperarDados(nomeBase))

    base.sort(([, a], [, b]) => {
        const campo = campos[0]

        if (!(campo in a) || !(campo in b)) return 0

        return String(a[campo])
            .localeCompare(String(b[campo]), 'pt-BR', { sensitivity: 'base' })
    })

    let opcoesDiv = ''

    for (const [cod, dado] of base) {

        const labels = campos
            .map(campo => `${(dado[campo] && dado[campo] !== '') ? `<label>${dado[campo]}</label>` : ''}`)
            .join('')

        const termo = encodeURIComponent(dado?.[campos[0]] || '')

        opcoesDiv += `
            <div name="camposOpcoes" class="atalhos" onclick="selecionar('${name}', '${cod}', '${termo}' ${funcaoAux ? `, '${funcaoAux}'` : ''})">
                ${labels}
            </div>`
    }

    const acumulado = `
        <div style="${vertical};">
            <div style="${horizontal}; width: 100%; justify-content: left; background-color: #b1b1b1;">

                <div class="pesquisa">
                    <input oninput="pesquisarCX(this)" placeholder="Pesquisar" style="width: 100%;">
                    <img src="imagens/pesquisar2.png">
                </div>

            </div>
            <div class="gavetaOpcoes">
                ${opcoesDiv}
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    popup(acumulado, 'Selecione o item', true)

}

async function selecionar(name, id, termo, funcaoAux) {
    termo = decodeURIComponent(termo)
    const elemento = document.querySelector(`[name='${name}']`)
    elemento.textContent = termo
    elemento.id = id
    removerPopup()

    if (funcaoAux) await eval(funcaoAux)
}

function pesquisarCX(input) {
    const termoPesquisa = String(input.value)
        .toLowerCase()
        .replace(/[./-]/g, ''); // remove ponto, traço e barra

    const divs = document.querySelectorAll(`[name='camposOpcoes']`);

    for (const div of divs) {
        const termoDiv = String(div.textContent)
            .toLowerCase()
            .replace(/[./-]/g, ''); // mesma limpeza no conteúdo

        div.style.display = (termoDiv.includes(termoPesquisa) || termoPesquisa === '') ? '' : 'none';
    }
}

function inicialMaiuscula(string) {
    if (string == undefined) {
        return ''
    }
    string.includes('_') ? string = string.split('_').join(' ') : ''

    if (string.includes('lpu')) return string.toUpperCase()
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}