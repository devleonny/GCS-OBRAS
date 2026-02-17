const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: start; gap: 5px;">
        <label><b>${valor1}:</b></label>
        <div style="text-align: justify;">${elemento}</div>
    </div>`

const botaoImg = (img, funcao) => `
    <div class="botaoImg">
        <img src="imagens/${img}.png" onclick="${funcao}">
    </div>`

const btnRodape = (texto, funcao) => `
    <button class="btnRodape" onclick="${funcao}">${texto}</button>
`
const btnPadrao = (texto, funcao) => `
    <span class="btnPadrao" onclick="${funcao}">${texto}</span>
`
const btn = ({ img, nome, funcao, id, elemento }) => `
    <div class="botao-lateral" ${id ? `id="${id}"` : ''} onclick="${funcao}">
        ${img ? `<img src="imagens/${img}.png">` : ''}
        ${elemento || ''}
        <div>${nome}</div>
    </div>
`

function solicitarPermissoes() {
    return new Promise((resolve, reject) => {
        if (!(cordova.plugins && cordova.plugins.permissions)) {
            popup({ mensagem: 'Plugin de permissões não está disponível. Algumas funcionalidades podem não funcionar.' })
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
                popup({ mensagem: `Falha ao verificar permissões. Verifique as configurações do dispositivo.` })
                return reject(new Error('Verificação de permissões falhou'));
            }

            resolve();
        }, (error) => {
            popup({ mensagem: `Erro ao solicitar permissões: ${error}`, titulo: 'Erro' })
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

async function irGCS() {
    overlayAguarde()
    await telaInicial()
    removerOverlay()
}

async function telaPrincipal() {

    localStorage.setItem('app', 'OCORRÊNCIAS')
    app = 'OCORRÊNCIAS'

    atribuirVariaveis()

    cUsuario.style.display = 'none'
    toolbar.style.display = ''
    toolbar.style.display = 'flex'

    if (priExeGCS)
        await atualizarGCS()

    const planoFundo = `
        <div class="planoFundo">
            <img src="gifs/loading.gif" style="width: 8rem;">
        </div>`

    const tInterna = `
        <div class="telaInterna">
            ${planoFundo}
        </div>
    `
    tela.innerHTML = tInterna

    carregarMenus()
    mostrarMenus(false)
    auxPendencias()

    if (!emAtualizacao)
        await criarElementosIniciais()

}

async function criarElementosIniciais() {

    const pFundo = document.querySelector('.planoFundo')
    if (!pFundo)
        return

    const hora = new Date().getHours()
    const saudacao = hora > 18
        ? 'Boa noite'
        : hora > 12
            ? 'Boa tarde'
            : 'Bom dia'

    const tAtrasados = modTab({
        base: 'dados_ocorrencias',
        pag: 'tAtrasados',
        body: 'tAtrasados',
        filtros: {},
        filtros: {
            'correcoes.*.executor': { op: '=', value: acesso.usuario },
            'snapshots.ultimaCorrecao': { op: '!=', value: 'Solucionada' },
            'correcoes.*.dtCorrecao': { op: '<d', value: Date.now() }
        },
        criarLinha: 'linCorrecoes'
    })

    const contadoresMeus = await contarPorCampo({
        base: 'dados_ocorrencias',
        path: 'snapshots.ultimaCorrecao',
        filtros: {
            'usuario': { op: '=', value: acesso.usuario }
        }
    })

    const baloesMeus = Object.entries(contadoresMeus)
        .filter(([st,]) => st !== 'todos' && st !== 'Solucionada')
        .map(([status, total]) => {

            return `
                <div class="pill" onclick="">
                    <span class="pill-a" style="background: #b12425;">${total}</span>
                    <span class="pill-b">${status}</span>
                </div>`
        })
        .join('')

    const tCorrecoes = modTab({
        base: 'dados_ocorrencias',
        pag: 'tCorrecoes',
        body: 'tCorrecoes',
        filtros: {},
        filtros: {
            'correcoes.*.executor': { op: '=', value: acesso.usuario },
            'snapshots.ultimaCorrecao': { op: '!=', value: 'Solucionada' }
        },
        criarLinha: 'linCorrecoes'
    })

    pFundo.innerHTML = `    
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/BG.png" style="width: 10rem;">
            <span style="padding: 1rem; font-size: 1rem; color: white;">
                <b>${saudacao}</b>,<br> Logo abaixo veja alguns atalhos para ocorrências que precisam de atenção:
            </span>
        </div>

        <div class="b-painel">

            <div class="b-atalhos">
                <span class="titul-1">Atrasados, reagendar</span>
                ${tAtrasados}
            </div>

            <div class="b-atalhos">
                <span class="titul-1">Correções <b>para você</b></span>
                ${tCorrecoes}
            </div>

            <div class="b-atalhos">
                <span class="titul-1">Minhas ocorrências abertas</span>
                ${baloesMeus || `<div style="${horizontal}; color: white; gap: 3px;"><span>Tudo certo por aqui</span> <img src="imagens/concluido.png"></div>`}
            </div>

        </div>`

    await paginacao()
}

async function linCorrecoes(ocorrencia) {

    const { id, usuario, snapshots, correcoes } = ocorrencia || {}
    const { cliente, sistema, prioridade } = snapshots || {}

    const linhas = []

    for (const correcao of Object.values(correcoes)) {

        const { descricao, executor, dtCorrecao } = correcao || {}

        if (executor !== acesso.usuario)
            continue

        return `
            <tr>
                <td>
                    <div class="balao-correcao"
                        onclick="controles.ocorrencias.filtros = {'id': { op: '=', value: '${id}'} }; telaOcorrencias();">
                        <span>Solicitado por <b>${usuario}</b> \npara <b>${executor}</b></span>
                        <div style="${horizontal}; gap: 1rem;">
                            <img src="imagens/alerta.png">
                            <div style="${vertical}">
                                <span style="font-size: 1rem;"><b>${id}</b></span>
                                <span><b>Data Limite:</b> ${conversorData(dtCorrecao)}</span>
                                <span><b>Unidade:</b> ${cliente?.nome || ''}</span>
                                <span><b>Sistema:</b> ${sistema}</span>
                                <span><b>Prioridade:</b> ${prioridade}</span>
                                <span><b>Descrição:</b> ${descricao}</span>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`
    }

    return linhas.join('')

}

function carregarMenus() {

    const blq = ['cliente', 'técnico']

    const menus = {
        'Atualizar': { img: 'atualizar', funcao: 'atualizarGCS()', proibidos: [] },
        'Início': { img: 'home', funcao: 'telaPrincipal()', proibidos: [] },
        'Criar Ocorrência': { img: 'baixar', funcao: 'formularioOcorrencia()', proibidos: [] },
        'Ocorrências': { img: 'configuracoes', funcao: 'telaOcorrencias()', proibidos: [] },
        'Relatório de Ocorrências': { img: 'planilha', funcao: 'telaRelatorio()', proibidos: ['user', 'técnico', 'visitante'] },
        'Relatório de Correções': { img: 'planilha', funcao: 'telaRelatorioCorrecoes()', proibidos: ['user', 'técnico', 'visitante'] },
        'Usuários': { img: 'perfil', funcao: 'telaUsuarios()', proibidos: ['user', 'cliente', 'técnico', 'analista', 'visitante'] },
        'Cadastros': { img: 'prancheta', funcao: 'telaCadastros()', proibidos: ['user', 'técnico', 'cliente', 'visitante'] },
        'Clientes & Fornecedores': { img: 'prancheta', funcao: 'telaClientes()', proibidos: ['user', 'técnico', 'cliente', 'visitante'] }
    }

    if (!blq.includes(acesso.permissao)) {
        menus.GCS = { img: 'LG', funcao: 'irGCS()', proibidos: ['técnico', 'visitante'] }
    }

    menus.Desconectar = { img: 'sair', funcao: 'deslogarUsuario()', proibidos: [] }

    const stringMenus = Object.entries(menus)
        .filter(([_, dados]) => !dados.proibidos.includes(acesso.permissao))
        .map(([nome, dados]) => btn({ ...dados, nome }))
        .join('');

    const botoes = `       
        <div style="${horizontal}; gap: 0.5rem; margin-bottom: 0.5rem;">
            <img src="imagens/alerta.png" onclick="mostrarPendencias()">
            <span style="color: white;">Ver atalhos</span>
        </div>
        <div class="painel-pendencias"></div>
        <br>
        ${stringMenus}

    `
    document.querySelector('.botoesMenu').innerHTML = botoes
}

function mostrarPendencias() {
    const p = document.querySelector('.painel-pendencias')
    const visivel = p.style.display

    p.style.display = (visivel === 'none' || visivel === '')
        ? 'flex'
        : 'none'
}

async function telaUsuarios() {

    titulo.textContent = 'Gerenciar Usuários'

    mostrarMenus(false)

    const colunas = {
        'Usuário': { chave: 'usuario' },
        'Nome': { chave: 'nome_completo' },
        'Empresa': { chave: 'snapshots.empresa' },
        'Setor': { chave: 'setor' },
        'Permissão': { chave: 'permissao' },
        '': {}
    }

    const tabela = modTab({
        base: 'dados_setores',
        pag: 'tUsuarios',
        body: 'tUsuarios',
        criarLinha: 'criarLinhaUsuario',
        colunas
    })

    const telaUsuario = `
        <div class="tela-usuarios">
            ${tabela}
        </div>
    `
    tela.innerHTML = telaUsuario

    await paginacao()

}

function criarLinhaUsuario(dados) {

    const { usuario, nome_completo, setor, permissao } = dados || {}
    const { empresa } = dados.snapshots || {}

    const tds = `
        <td>${usuario}</td>
        <td>${nome_completo || ''}</td>
        <td>${empresa}</td>
        <td>${setor}</td>
        <td>${permissao}</td>
        <td><img onclick="gerenciarUsuario('${usuario}')" src="imagens/pesquisar2.png"></td>
    `
    return `<tr>${tds}</tr>`
}

async function gerenciarUsuario(id) {

    const usuario = await recuperarDado('dados_setores', id)

    const empresasOpcoes = ((await pesquisarDB({ base: 'empresas' })).resultados || [])
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(empresa => `<option value="${empresa.id}" ${usuario?.empresa == empresa.id ? 'selected' : ''}>${empresa.nome}</option>`)
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

    popup({ linhas, titulo: 'Gerenciar Usuário' })

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


