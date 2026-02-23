const botaoRodape = (funcao, texto, img) => `
        <div class="botoesRodape" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>`

const modelo = (valor1, valor2) => `
    <div class="modelo">
        <label>${valor1}</label>
        <div style="width: 100%; text-align: left;">${valor2}</div>
    </div>`

const labelDestaque = (valor1, valor2) => {

    if (!valor2)
        return ''

    return `
    <div style="${vertical}">
        <div><strong>${valor1}:</strong></div>
        <div style="text-align: left; white-space: pre-wrap;">${valor2}</div>
    </div>`
}

const botao = (valor1, funcao, cor) => `
        <div class="contorno-botoes" style="background-color: ${cor}e3; border: solid 1px ${cor};" onclick="${funcao}">
            <label style="white-space: nowrap;">${valor1}</label>
        </div>`

const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>`

const balaoPDF = ({ nf, tipo, codOmie, app }) => {
    return `
    <div class="balaoNF" onclick="abrirDANFE('${codOmie}', '${tipo}', '${app}')">
        <div class="balao1">
            <label>${nf}</label>
            <label><b>${tipo}</b></label>
        </div>
        <div class="balao2">
            PDF
        </div>
    </div>`
}

const modeloBotoes = (imagem, nome, funcao) => {
    return `
    <div class="atalhos" style="width: 100%;" onclick="${funcao}">
        <img src="imagens/${imagem}.png">
        <label style="cursor: pointer;">${nome}</label>
    </div>
    `
}

const layoutBotao = (nome, funcao, img) => `
    <div onclick="${funcao}" class="botoesRodape">
        <img src="imagens/${img}.png" style="cursor: pointer; width: 2vw;">
        <label>${nome}</label>
    </div>
`

function criarAtalhoMenu({ nome, img, funcao }) {
    const atalho = `
    <div class="botao-lateral" onclick="executar('${funcao}')">
        <img src="imagens/${img}.png">
        <div>${nome}</div>
    </div>
    `
    return atalho
}

async function executar(nomeFuncao) {

    if (!nomeFuncao) return

    // É a função que carrega a tela atual;
    if (nomeFuncao.includes('tela')) funcaoTela = nomeFuncao

    funcaoAtiva = nomeFuncao

    if (typeof window[nomeFuncao] === "function") {
        return await window[nomeFuncao]()
    } else {
        popup({ mensagem: `<b>Função não encontrada:</b> ${nomeFuncao}` })
    }

}

function criarMenus(chave) {
    telaAtiva = chave
    const botoesMenu = document.querySelector('.botoesMenu')
    const atalhos = esquemaBotoes[chave]

    const atalhosString = [...atalhoInicial, ...atalhos]
        .map(atalho => criarAtalhoMenu(atalho))
        .join('')

    botoesMenu.innerHTML = atalhosString
}

const atalhoInicial = [
    { nome: 'Atualizar GCS', funcao: 'atualizarGCS', img: 'atualizar' },
    { nome: 'Menu Inicial', funcao: 'telaInicialGCS', img: 'LG' }
]

const esquemaBotoes = {
    inicial: [
        { nome: 'Orçamentos', funcao: `rstTelaOrcamentos`, img: 'projeto' },
        { nome: 'Composições', funcao: `telaComposicoes`, img: 'composicoes' },
        { nome: 'Clientes & Fornecedores', funcao: `telaClientes`, img: 'editar3' },
        { nome: 'Chamados', funcao: `telaChamados`, img: 'chamados' },
        { nome: 'Veículos', funcao: `telaVeiculos`, img: 'veiculo' },
        { nome: 'Reembolsos', funcao: `telaPagamentos`, img: 'reembolso' },
        { nome: 'Estoque', funcao: `telaEstoque`, img: 'estoque' },
        //{ nome: 'Faturamento NFs', funcao: `telaRelatorioOmie`, img: 'relatorio' },
        { nome: 'RH', funcao: `telaRH`, img: 'gerente' },
        { nome: 'Ocorrências', funcao: `telaInicialOcorrencias`, img: 'LG' },
        { nome: 'Desconectar', funcao: `deslogarUsuario`, img: 'sair' }
    ],
    criarOrcamentos: [
        { nome: 'Dados Cliente', funcao: `painelClientes`, img: 'gerente' },
        { nome: 'Salvar Orçamento', funcao: `enviarDadosOrcamento`, img: 'salvo' },
        { nome: 'Apagar Orçamento', funcao: `apagarOrcamento`, img: 'cancel' },
        { nome: 'Orçamentos', funcao: `rstTelaOrcamentos`, img: 'voltar_2' }
    ],
    criarOrcamentosAluguel: [
        { nome: 'Dados Cliente', funcao: `painelClientes`, img: 'gerente' },
        { nome: 'Salvar Orçamento', funcao: `enviarDadosAluguel`, img: 'salvo' },
        { nome: 'Apagar Orçamento', funcao: `apagarOrcamentoAluguel`, img: 'cancel' },
        { nome: 'Orçamentos', funcao: `rstTelaOrcamentos`, img: 'voltar_2' }
    ],
    orcamentos: [
        { nome: 'Baixar em Excel', funcao: 'excelOrcamentos', img: 'excel' },
        { nome: 'Criar Orçamento', funcao: `telaCriarOrcamento`, img: 'projeto' },
        { nome: 'Criar Orçamento Aluguel', funcao: `telaCriarOrcamentoAluguel`, img: 'projeto' },
    ],
    composicoes: [
        { nome: 'Cadastrar Item', funcao: 'cadastrarItem', img: 'baixar' },
        { nome: 'Baixar em Excel', funcao: 'exportarParaExcel', img: 'excel' }
    ],
    chamados: [
        { nome: 'Criar Manutenção', funcao: 'criarManutencao', img: 'chamados' },
        { nome: 'Baixar em Excel', funcao: 'excelChamados', img: 'excel' }
    ],
    veiculos: [
        { nome: 'Adicionar Combustível', funcao: 'painelValores', img: 'combustivel' },
        { nome: 'Veículos', funcao: 'auxVeiculos', img: 'veiculo' },
    ],
    pagamentos: [
        { nome: 'Solicitar Pagamento', funcao: `formularioPagamento`, img: 'dinheiro' }
    ],
    estoque: [
        { nome: 'Cadastrar Item', funcao: 'incluirItemEstoque', img: 'baixar' },
        { nome: 'Relatório de Movimentos', funcao: 'relatorioMovimento', img: 'projeto' },
        { nome: 'Baixar em Excel', funcao: `exportarParaExcel`, img: 'excel' },
    ],
    relatorio: [
        { nome: 'Baixar em Excel', funcao: 'excelRecebimento', img: 'excel' },
        { nome: 'Limpar Filtros', funcao: 'limparFiltros', img: 'limpar' },
    ],
    rh: [
        { nome: 'Baixar em Excel', funcao: 'rhExcel', img: 'excel' },
        { nome: 'Incluir Documento', funcao: 'incluirDocumento', img: 'baixar' }
    ],
    clientes: [
        { nome: 'Novo cadastro', funcao: 'formularioCliente', img: 'baixar' }
    ]
}

async function lembreteNotas() {

    const notas = Object
        .values(db?.informacoes?.notas?.objeto || {})
        .map(n => {
            return `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/pesquisar2.png" onclick="abrirEsquema('${n.idOrcamento}')">
                <span class="etiqueta-atrasado"><b>${n.nNota}</b> ${n.status} </span>
            </div>
            `
        })
        .join('')

    const elemento = `
        <div class="painel-notas">
            <span>Notas Canceladas, etc</span>
            <hr>
            ${notas}
        </div>
    `

    popup({ elemento })

}

async function salvarDepartamento(img) {

    overlayAguarde()

    const input = img.previousElementSibling
    const nome = input.value

    if (!nome) return popup({ mensagem: 'Nome em branco', nra: true })

    const resposta = await criarDepDiretamente(nome)

    if (resposta.mensagem) return popup({ mensagem: resposta.mensagem, nra: true })
    input.value = ''
    img.style.display = 'none'

    popup({ mensagem: 'Salvo com successo', nra: true })
}

async function respostaSincronizacao(script) {

    let localResposta = document.getElementById('localResposta')

    localResposta.innerHTML = `<img src="gifs/loading.gif" style="width: 5rem;">`

    const resposta = await sincronizar(script)

    localResposta.innerHTML = resposta.mensagem || 'Sem resposta'

    if (resposta.mensagem == 'Sincronizado') await atualizarGCS()

}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function mudarStatus(select) {

    const st = select.value

    const img = document.querySelector('[name="imgStatus"]')

    img.src = `imagens/${st}.png`

    await alterarUsuario({ campo: 'status', valor: st, usuario: acesso.usuario })

}

function balaoUsuario(st, texto) {

    if (document.title == 'PDF') return

    let msg = document.querySelector('.popup-mensagem')
    if (msg) msg.remove()

    const mensagemPop = `
        <div class="popup-mensagem">
            <img src="imagens/${st}.png">
            <span>${st}</span>
            <span>${texto}</span>
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', mensagemPop)

    msg = document.querySelector('.popup-mensagem')

    requestAnimationFrame(() => {
        msg.style.opacity = '1'
        msg.style.transform = 'translateY(0)'
    })

    setTimeout(() => {
        msg.style.opacity = '0'
        msg.style.transform = 'translateY(20px)'
        setTimeout(() => msg.remove(), 400)
    }, 5000)
}

async function usuariosToolbar() {

    if (!acesso)
        return

    acesso = await recuperarDado('dados_setores', acesso.usuario) || JSON.parse(localStorage.getItem('acesso')) || {}

    const uOnline = await contarPorCampo({ base: 'dados_setores', path: 'status' })

    const indicadorStatus = acesso?.status || 'offline'

    const usuariosToolbarString = `
        <div class="botaoUsuarios">
            <img name="imgStatus" onclick="painelUsuarios()" src="imagens/${indicadorStatus}.png">
            <label style="font-size: 1.2rem;">${uOnline?.online || 0}</label>
        </div>`

    if (nomeUsuario)
        nomeUsuario.innerHTML = `<span><b>${inicialMaiuscula(acesso?.permissao || '')}</b> ${acesso.usuario || ''}</span>`

    const divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios)
        divUsuarios.innerHTML = usuariosToolbarString

}

function linUsuarios(dados) {

    const listas = {
        permissoes: ['', 'adm', 'técnico', 'cliente', 'visitante', 'user', 'visitante', 'analista', 'gerente', 'coordenacao', 'diretoria', 'editor', 'log', 'qualidade', 'novo'],
        setores: ['', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO', 'RH', 'CHAMADOS', 'SUPORTE', 'POC']
    }

    const tdPreenchida = (coluna, opcoes, usuario) => `
        <td>
            <select class="opcoesSelect" onchange="alterarUsuario({campo: '${coluna}', usuario: '${usuario}', select: this})" style="cursor: pointer;">${opcoes}</select>
        </td>
    `
    const { permissao, setor, usuario } = dados

    const opcoesPermissao = listas.permissoes
        .map(p => `<option value="${p}" ${permissao == p ? 'selected' : ''}>${p}</option>`).join('')

    const opcoesSetores = listas.setores
        .map(s => `<option value="${s}" ${setor == s ? 'selected' : ''}>${s}</option>`).join('')

    return `
        <tr>
            <td style="text-align: left;">${usuario}</td>
            ${tdPreenchida('permissao', opcoesPermissao, usuario)}
            ${tdPreenchida('setor', opcoesSetores, usuario)}
        </tr>`

}

async function configs() {

    const colunas = {
        'Usuário': { chave: 'usuario' },
        'Permissão': { chave: 'permissao' },
        'Setores': { chave: 'setor' }
    }

    const tabela = modTab({
        pag: 'usuarios',
        colunas,
        base: 'dados_setores',
        criarLinha: 'linUsuarios',
        body: 'bodyUsuarios'
    })

    const elemento = `
        <div style="${vertical}; padding: 0.5rem;">
            ${tabela}
        </div>`

    popup({ elemento, titulo: 'Configurações' })

    await paginacao()

}

async function alterarUsuario({ campo, usuario, select, valor }) {

    valor = select ? select.value : valor

    const alteracao = await comunicacaoServ({ usuario, campo, valor }) // Se alterar no servidor, altera localmente;

    if (!alteracao?.success) {
        popup({ mensagem: `Não foi possível alterar: ${alteracao?.mensagem || 'Tente novamente mais tarde'}`, nra: true })
        if (select)
            select.value = dados_setores[usuario][campo] // Devolve a informação anterior pro elemento;
    }

}

function verifTimestampNome(nome) {
    let regex = /^(\d{13})\.\w+$/;
    let match = nome.match(regex);

    if (match) {
        let timestamp = parseInt(match[1]);
        let data = new Date(timestamp);
        return !isNaN(data.getTime()) && data.getFullYear() > 2000;
    }

    return false;
}


async function carregarXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.async = true;

        script.onload = () => {
            const checkInitialization = () => {
                if (typeof XLSX !== 'undefined' && typeof XLSX.utils !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        };

        script.onerror = () => {
            reject(new Error("Falha ao carregar a biblioteca XLSX"));
        }

        document.head.appendChild(script);
    });
}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function irPdf(id, emAnalise) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    orcamento.emAnalise = emAnalise

    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('pdf.html', '_blank')

}

async function recuperarClientes() {

    await sincronizarDados({ base: 'dados_clientes', overlay: true })

}

async function salvarLevantamento(idOrcamento, idElemento) {

    overlayAguarde()

    const input = document.getElementById(idElemento || 'adicionar_levantamento')
    const marcador = input?.dataset?.finalizado == 'S'

    try {
        const anexos = await importarAnexos({ input }) // Nova função de upload

        const anexoDados = {}
        anexos.forEach(anexo => {
            if (marcador) anexo.finalizado = 'S'
            const idAnexo = ID5digitos()
            anexoDados[idAnexo] = anexo
        })

        if (idOrcamento) {

            const orcamentoBase = await recuperarDado('dados_orcamentos', idOrcamento) || {}

            orcamentoBase.levantamentos ??= {}

            Object.assign(orcamentoBase.levantamentos, anexoDados)

            await inserirDados({ [idOrcamento]: orcamentoBase }, 'dados_orcamentos')

            for (const [idAnexo, anexo] of Object.entries(anexoDados)) {
                await enviar(`dados_orcamentos/${idOrcamento}/levantamentos/${idAnexo}`, anexo)
            }

        } else {

            const orcamentoBase = baseOrcamento()

            orcamentoBase.levantamentos ??= {}

            Object.assign(orcamentoBase.levantamentos, anexoDados)
            baseOrcamento(orcamentoBase)
        }

        // Retornar as telas específicas;
        const painelC = document.querySelector('.painel-clientes')
        if (painelC) return await painelClientes(idOrcamento)

        const painelH = document.querySelector('.painel-historico')
        if (painelH) return await abrirEsquema(idOrcamento)

        if (idOrcamento) return await abrirEsquema(idOrcamento)

    } catch (error) {
        popup({ mensagem: `Erro ao fazer upload: ${error.message}`, nra: true })
    }
}

async function excluirLevantamentoStatus(idAnexo, id) {

    overlayAguarde()

    const orcamento = id
        ? await recuperarDado('dados_orcamentos', id)
        : baseOrcamento()

    delete orcamento.levantamentos[idAnexo]

    if (id) {
        deletar(`dados_orcamentos/${id}/levantamentos/${idAnexo}`)
        await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    } else {
        baseOrcamento(orcamento)
    }

    // Retornar as telas específicas;
    const painelC = document.querySelector('.painel-clientes')
    if (painelC)
        return await painelClientes(id)

    const painelH = document.querySelector('.painel-historico')
    if (painelH)
        return await abrirEsquema(id)

    if (id)
        return await abrirEsquema(id)

}

function filtrarAAZ(coluna, id) {

    let el = document.getElementById(id)
    let tbody = el.tagName === "TBODY" ? el : el.tBodies[0]
    if (!tbody) return

    let linhas = Array.from(tbody.rows)
    let ascendente = (el.dataset.order ?? "desc") !== "asc"

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna] || '')
        let valorB = capturarValorCelula(b.cells[coluna] || '')

        // Normaliza números com "R$", vírgula etc.
        const parseValor = v => {
            if (typeof v !== 'string') return v
            return parseFloat(
                v.replace(/[^\d,-]/g, '')
                    .replace(',', '.')
            )
        }

        const numA = parseValor(valorA)
        const numB = parseValor(valorB)

        if (!isNaN(numA) && !isNaN(numB)) {
            return ascendente ? numA - numB : numB - numA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    })

    linhas.forEach(linha => tbody.appendChild(linha))
    el.dataset.order = ascendente ? "asc" : "desc"
}

function capturarValorCelula(celula) {
    if (!celula) return ''

    let entrada =
        celula.querySelector('input') ||
        celula.querySelector('textarea') ||
        celula.querySelector('select')

    if (entrada) return entrada.value.toLowerCase()

    return celula.textContent.toLowerCase()
}

async function filtrarUsuarios(st) {

    overlayAguarde()

    let filtros = {}

    if (st == 'online') {
        filtros = {
            'status': [
                { op: '!=', value: null },
                { op: '!=', value: 'offline' }
            ]
        }

    } else {
        filtros = {
            'status': { op: '!=', value: 'online' }
        }
    }

    controles.usuariosOnline.filtros = filtros
    await paginacao()

    removerOverlay()

}

async function painelUsuarios() {

    const colunas = {
        'Status': { chave: 'status' },
        'Usuários': { chave: 'usuario' },
        'Setor': { chave: 'setor' },
        'Permissão': { chave: 'permissao' }
    }

    const btnExtras = `
        <button onclick="filtrarUsuarios('online')">Online</button>
        <button style="background-color: #ff0000;" onclick="filtrarUsuarios('offline')">Offline</button>`

    const tOnline = modTab({
        pag: 'usuariosOnline',
        colunas,
        btnExtras,
        body: 'bodyUsuariosOnline',
        base: 'dados_setores',
        criarLinha: 'criarLinhaPainelUsuarios',
        filtros: {
            'status': [
                { op: '!=', value: null },
                { op: '!=', value: 'offline' }
            ]
        }
    })

    const elemento = `
        <div class="conteinerOnline">

            ${tOnline}

        </div>`

    const divOnline = document.querySelector('.divOnline')
    if (divOnline)
        return

    popup({ elemento, titulo: 'Usuários', nra: true })

    await paginacao()
}

function criarLinhaPainelUsuarios(dados) {

    const { usuario, status, setor, permissao } = dados || {}

    let gerenciarStatus = `<label>${status || 'offline'}</label>`

    if (usuario == acesso.usuario) {

        const statusOpcoes = ['online', 'Em almoço', 'Não perturbe', 'Em reunião', 'Apenas Whatsapp']
        if (acesso?.permissao == 'adm')
            statusOpcoes.push('Invisível')

        gerenciarStatus = `
            <select class="opcoesSelect" onchange="mudarStatus(this)">
                ${statusOpcoes.map(op => `<option ${acesso?.status == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>`
    }

    return `
    <tr>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 0.5rem;">
                <img src="imagens/${status || 'offline'}.png" style="width: 1.5rem;">
                ${gerenciarStatus}
            </div>
        </td>
        <td>
            ${usuario}
        </td>
        <td>
            ${permissao || ''}
        </td>
        <td>
            ${setor || ''}
        </td>
    </tr>`
}

async function gerarPdfOnline(htmlString, nome) {
    return new Promise((resolve, reject) => {
        let encoded = new TextEncoder().encode(htmlString);
        let compressed = pako.gzip(encoded);

        fetch(`${api}/pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: compressed
        })
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `${nome}.pdf`;
                link.click();
                resolve()
            })
            .catch(err => {
                console.error("Erro ao gerar PDF:", err)
                reject()
            });
    })

}

async function relancarPagamento(idPagamento) {

    const { app } = await recuperarDado('lista_pagamentos', idPagamento)

    const elemento = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">

            <div style="${horizontal}; gap: 1rem;">
                <span>Qual APP deve ser relançado?</span>
                <select class="opcoesSelect" id="app">
                    ${['AC', 'IAC', 'HNK'].map(op => `<option ${app == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            </div>
            <hr style="width: 100%;">
            <button onclick="confirmarRelancamento('${idPagamento}')">Confirmar</button>
        </div>
    `
    popup({ elemento, titulo: 'Escolha o APP', nra: true })
}

async function confirmarRelancamento(idPagamento) {

    const app = document.getElementById('app').value

    removerPopup()
    overlayAguarde()

    const pagamento = await recuperarDado('lista_pagamentos', idPagamento)
    pagamento.app = app

    await enviar(`lista_pagamentos/${idPagamento}/app`, app)

    const resposta = await lancarPagamento({ pagamento, dataFixa: true })

    pagamento.status = 'Processando...'

    await inserirDados({ [idPagamento]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(idPagamento)

    const textoPrincipal = resposta?.objeto?.descricao_status || resposta?.mensagem || JSON.stringify(resposta)
    const infoAdicional = resposta?.objeto?.exclusaoPagamento || ''
    const mensagem = `
        <div style="${vertical}; gap: 5px; text-align: left;">
            <span>${textoPrincipal}</span>
            <span>${infoAdicional}</span>
        </div>`

    popup({ mensagem, imagem: 'imagens/atualizar.png', titulo: 'Resposta' })

}

async function reprocessarAnexos(idPagamento) {
    overlayAguarde()
    return new Promise((resolve, reject) => {

        fetch(`${api}/reprocessar_anexos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idPagamento })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                console.log(JSON.parse(data))
                popup({ mensagem: 'Finalizado', imagem: 'imagens/concluido.png' })
                resolve(data);
            })
            .catch(err => {
                console.log(err)
                popup({ mensagem: 'Finalizado', imagem: 'imagens/concluido.png' })
                reject(err)
            })
    })
}

async function lancarPagamento({ pagamento, call, dataFixa }) {

    if (!pagamento.param[0]?.codigo_lancamento_integracao)
        pagamento.param[0].codigo_lancamento_integracao = pagamento.id

    const response = await fetch(`${api}/lancar_pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagamento, call, dataFixa })
    })

    if (!response.ok)
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

    return await response.json()
}

function sincronizar(script) {
    return new Promise((resolve, reject) => {

        fetch(`${api}/sincronizar`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script })
        })
            .then(response => response.text())
            .then(data => {
                resolve(JSON.parse(data))
            })
            .catch(error => {
                reject(error)
            });

    })
}

async function verAprovacoes() {

    const colunas = {
        'Contrato': { chave: 'snapshots.contrato' },
        'Cliente': { chave: 'snapshots.cliente' },
        'Total Original <br>[s/desc ou acres]': '',
        'Total Geral': { chave: 'snapshots.valor' },
        '%': '',
        'Localização': { chave: 'snapshots.cidade' },
        'Usuário': { chave: 'snapshots.responsavel' },
        'Aprovação': { chave: 'aprovacao.status' },
        'Comentário': { chave: 'aprovacao.justificativa' },
        'Detalhes': ''
    }
    const pag = 'aprovacao'
    const tabela = modTab({
        colunas,
        pag,
        base: 'dados_orcamentos',
        pag: 'aprovacao',
        criarLinha: 'criarLinhaAprovacao',
        body: 'tAprovacao',
        filtros: { 'aprovacao': { op: 'NOT_EMPTY' } }
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            ${tabela}

        </div>
    `
    popup({ elemento, titulo: 'Aprovações de Orçamento' })

    await paginacao(pag)

}

async function criarLinhaAprovacao(orcamento) {

    const { dados_orcam = {}, snapshots = {} } = orcamento || {}
    const idOrcamento = orcamento.id
    const aprovacao = orcamento.aprovacao
    const status = aprovacao?.status || 'desconhecido'
    const porcentagemDiferenca = (((orcamento.total_geral - orcamento.total_bruto) / orcamento.total_bruto) * 100).toFixed(2)
    const campos = [dados_orcam?.chamado, dados_orcam?.contrato, dados_orcam?.data]
        .filter(c => c)
        .join('<br>')

    return `
        <tr>
            <td style="text-align: left;">
                ${campos}
            </td>
            <td style="text-align: left;">${(snapshots?.cliente || '').toUpperCase()}</td>
            <td style="white-space: nowrap;">${dinheiro(orcamento.total_bruto)}</td>
            <td style="white-space: nowrap;">${dinheiro(orcamento.total_geral)}</td>
            <td><label class="labelAprovacao" style="background-color: ${porcentagemDiferenca > 0 ? 'green' : '#B12425'}">${porcentagemDiferenca}%</label></td>
            <td>${(snapshots?.cidade || '').toUpperCase()}</td>
            <td>${aprovacao?.usuario || '--'}</td>
            <td>
                <div style="display: flex; align-items: center; justify-content: start; gap: 1vw;">
                    <img src="imagens/${status}.png">
                    <label>${status}</label>
                </div>
            </td>
            <td>${aprovacao?.justificativa || '--'}</td>
            <td><img src="imagens/pesquisar2.png" onclick="verPedidoAprovacao('${idOrcamento}')"></td>
        </tr>
        `

}

async function verificarPendencias() {

    if (!navigator.onLine) return

    const contador = await contarPorCampo({ base: 'dados_orcamentos', path: 'aprovacao.status' })

    const contadorPendencias = document.getElementById('contadorPendencias')
    if (!contadorPendencias)
        return

    contadorPendencias.style.display = contador.pendente > 0 ? 'flex' : 'none'
    contadorPendencias.textContent = contador.pendente

}

async function verPedidoAprovacao(idOrcamento) {

    const permissao = acesso.permissao
    const pessoasPermitidas = ['adm', 'diretoria']
    if (!pessoasPermitidas.includes(permissao)) return popup({ mensagem: 'Você não tem acesso' })

    let tabelas = {}
    let divTabelas = ''

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const omieCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omieCliente)
    const lpu = orcamento.lpu_ativa ? String(orcamento.lpu_ativa).toLowerCase() : null

    for (const [codigo, composicao] of Object.entries(orcamento?.dados_composicoes || {})) {

        const quantidade = composicao.qtde
        const custo = composicao.custo
        const custoOriginal = composicao?.custo_original || false
        const tipo = composicao.tipo

        if (!tabelas[tipo]) tabelas[tipo] = { linhas: '' }

        const total = quantidade * custo;
        let desconto = 0

        if (composicao.tipo_desconto) {
            desconto = composicao.tipo_desconto != 'Porcentagem'
                ? composicao.desconto
                : total * (composicao.desconto / 100);
        }

        const totalOriginal = custoOriginal * quantidade
        const labelCusto = dinheiro(custoOriginal ? custoOriginal : custo)
        const labelTotal = dinheiro(custoOriginal ? totalOriginal : total)
        const labelTotalDesconto = dinheiro(total - desconto)

        let diferenca = '--', cor = '';
        if (custoOriginal && custo !== custoOriginal) {
            diferenca = dinheiro((custo - custoOriginal) * quantidade)
            cor = 'green'

        } else if (desconto > 0) {
            diferenca = dinheiro(desconto)
            cor = '#B12425'
        }

        tabelas[tipo].linhas += `
            <tr>
                <td>${composicao.descricao}</td>
                <td>${quantidade}</td>
                <td>
                    <div style="${horizontal}; gap: 2rem;">
                        <span style="white-space: nowrap;">${labelCusto}</span>
                        <img src="imagens/preco.png" onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" style="width: 2rem; cursor: pointer;">
                    </div>
                </td>
                <td style="white-space: nowrap;">${labelTotal}</td>
                <td>
                    <div style="${vertical}; gap: 2px;">
                        ${composicao?.tipo_desconto == 'Venda Direta' ? '<label>Venda Direta</label>' : ''}
                        <label class="labelAprovacao" style="background-color: ${cor}">${diferenca}</label>
                    </div>
                </td>
                <td>${labelTotalDesconto}</td>
            </tr>
        `
    }

    for (const [tabela, objeto] of Object.entries(tabelas)) {

        divTabelas += `
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <label style="font-size: 1rem; padding: 0.5rem;"><b>${tabela}</b></label>
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th>Quantidade</th>
                                <th>Unitário</th>
                                <th>Total</th>
                                <th>Diferença</th>
                                <th>Total Geral</th>
                            </tr>
                        </thead>
                        <tbody>${objeto.linhas}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>
            `
    }

    const divOrganizada = (valor, termo) => {
        return `
            <div style="${vertical}; width: 100%; margin-bottom: 5px;">
                <label style="text-align: left;"><b>${termo}</b></label>
                <label style="text-align: left;"><small>${valor}</small></label>
            </div>
        `
    }

    let totalBruto = orcamento?.total_bruto
    let totalGeral = conversor(orcamento.total_geral)
    let diferencaDinheiro = totalGeral - totalBruto
    let diferencaPorcentagem = `${(diferencaDinheiro / totalBruto * 100).toFixed(2)}%`

    const elemento = `
        <div class="painelAprovacoes">
            
            <div style="display: flex; align-items: center; justify-content: start; gap: 2vw;">
                <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                    ${divOrganizada(orcamento?.dados_orcam?.analista || '--', 'Solicitante')}
                    ${divOrganizada(cliente?.nome || '?', 'Cliente')}
                    ${divOrganizada(cliente?.cidade || '?', 'Localidade')}
                </div>
                <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                    ${divOrganizada(dinheiro(totalGeral), 'Total Geral')}
                    ${divOrganizada(dinheiro(totalBruto), 'Total Original (sem Acréscimo e/ou Desconto)')}
                    ${divOrganizada(`<label class="labelAprovacao" style="background-color: ${diferencaDinheiro > 0 ? 'green' : '#B12425'}">${dinheiro(diferencaDinheiro)}</label>`, 'Diferença em Dinheiro')}
                    ${divOrganizada(diferencaPorcentagem, 'Percentual')}
                </div>
            </div>

            <hr style="width: 100%;">

            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;" onclick="visibilidadeOrcamento(this)">
                <img src="imagens/olhoFechado.png" style="width: 1.2rem;">
                <label style="text-decoration: underline; cursor: pointer;">Ver itens do Orçamento</label>
                
            </div>

            <div style="display: none; align-items: start; justify-content: center; flex-direction: column; gap: 5px;">
                ${divTabelas}
            </div>

            <hr>

            <div style="width: 80%; position: relative; color: #222; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">
                <label>Comentar</label>
                <textarea rows="5" style="background-color: white; border: none; width: 90%; color: #222;"></textarea>

                <div style="display: flex; justify-content: left; gap: 5px;">
                    <button style="background-color: green;" onclick="respostaAprovacao(this, '${idOrcamento}', 'aprovado')">Autorizar</button>
                    <button style="background-color: #B12425;" onclick="respostaAprovacao(this, '${idOrcamento}', 'reprovado')">Reprovar</button>
                </div>
            </div>

        </div>
    `

    popup({ elemento, titulo: 'Detalhes' })

}

function visibilidadeOrcamento(div) {
    let img = div.querySelector('img')
    let label = div.querySelector('label')
    let divTabelas = div.nextElementSibling
    let display = divTabelas.style.display

    if (display == 'none') {
        divTabelas.style.display = 'flex'
        img.src = 'imagens/olhoAberto.png'
        label.textContent = 'Ocultar itens'
    } else {
        divTabelas.style.display = 'none'
        img.src = 'imagens/olhoFechado.png'
        label.textContent = 'Ver itens do Orçamento'
    }
}

async function respostaAprovacao(botao, idOrcamento, status) {

    // Dois popups pra fechar;
    removerPopup()
    removerPopup()

    const justificativa = botao.parentElement.parentElement.querySelector('textarea').value
    const dados = {
        usuario: acesso.usuario,
        data: new Date().toLocaleString(),
        status,
        justificativa
    }

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    orcamento.aprovacao = {
        ...orcamento.aprovacao,
        ...dados
    }

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/aprovacao`, orcamento.aprovacao)

    await verAprovacoes()
    verificarPendencias()

}

function baseOrcamento(orcamento, remover = false) {
    let temporario = JSON.parse(localStorage.getItem('temporario')) || {}

    const getModalidade = (orc) => {
        if (orc?.lpu_ativa) {
            return orc.lpu_ativa === 'ALUGUEL' ? 'aluguel' : 'orcamento'
        }
        return String(telaAtiva).includes('Aluguel') ? 'aluguel' : 'orcamento'
    }

    const modalidade = getModalidade(orcamento || temporario)

    // remover
    if (remover) {
        delete temporario[modalidade]
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return
    }

    // salvar
    if (orcamento) {
        temporario[modalidade] = orcamento
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return
    }

    // ler
    return temporario[modalidade] || null
}

async function verificarNF(numero, tipo, app) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/notas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numero, tipo, app })
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
                console.error(err)
                reject()
            });
    })
}

async function attClientes() {
    overlayAguarde()
    await atualizarGCS()
    removerOverlay()
}

async function painelClientes(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const orcamentoBase = idOrcamento
        ? orcamento
        : baseOrcamento()

    const { dados_orcam } = orcamentoBase || {}
    const idCliente = dados_orcam?.omie_cliente
    const bloq = orcamentoBase.hierarquia ? true : false

    const cliente = await recuperarDado('dados_clientes', idCliente)
    const parcelas = ["--", "15 dias", "20 dias", "30 dias", "35 dias", "45 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]

    const levantamentos = Object.entries(orcamentoBase?.levantamentos || {})
        .map(([idAnexo, anexo]) =>
            criarAnexoVisual(
                anexo.nome,
                anexo.link,
                idOrcamento
                    ? `excluirLevantamentoStatus('${idAnexo}', '${idOrcamento}')`
                    : `excluirLevantamentoStatus('${idAnexo}')`))
        .join('')

    const funcao = idOrcamento
        ? `salvarDadosCliente('${idOrcamento}')`
        : 'salvarDadosCliente()'

    const botoes = [
        { texto: 'Salvar Dados', img: 'concluido', funcao },
        { texto: 'Atualizar', img: 'atualizar', funcao: `attClientes()` },
    ]

    if (idOrcamento)
        botoes.push({ texto: 'Limpar Campos', img: 'limpar', funcao: 'executarLimparCampos()' })


    controlesCxOpcoes.cliente = {
        retornar: ['nome'],
        base: 'dados_clientes',
        funcaoAdicional: ['buscarDadosCliente'],
        colunas: {
            'Nome Fantasia': { chave: 'nome' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' },
            'CNPJ/CPF': { chave: 'cnpj' }
        }
    }

    controlesCxOpcoes.chamado = {
        retornar: ['id'],
        base: 'dados_ocorrencias',
        funcaoAdicional: ['buscarDadosCliente'],
        colunas: {
            'Chamado': { chave: 'id' }
        }
    }

    const oTransportadoras = transportadoras
        .map(o => `<option ${dados_orcam?.transportadora == o ? 'selected' : ''}>${o}</option>`)
        .join('')

    const linhas = [
        {
            texto: 'Chamado',
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <span 
                        class="opcoes" 
                        name="chamado"
                        ${dados_orcam?.chamado ? `id="${dados_orcam?.chamado}"` : ''}
                        onclick="cxOpcoes('chamado')">
                            ${dados_orcam?.chamado || 'Selecione'}
                    </span>
                    <input value="${dados_orcam?.contrato || 'ORC ...'}" readOnly>
                </div>
            `
        },
        {
            elemento: `
            <div style="${horizontal}; gap: 3px;">
                <span>Classificar orçamento na aba de <b>CHAMADO</b></span>
                <input id="filtroChamado" ${styChek} type="checkbox" ${orcamentoBase?.chamado == 'S' ? 'checked' : ''}>
            </div>
            `
        },
        {
            texto: 'Cliente',
            elemento: `
            <div style="${horizontal}; gap: 3px">
                ${bloq
                    ? `<img src="imagens/proibido.png">` : ''}
                <span ${dados_orcam?.omie_cliente
                    ? `id="${dados_orcam.omie_cliente}"`
                    : ''} 
                    class="opcoes" 
                    name="cliente" 
                    ${bloq ? '' : `onclick="cxOpcoes('cliente')"`}>
                        ${cliente?.nome || 'Selecione'}
                </span>
                ${bloq ? '' : `<img onclick="formularioCliente()" src="imagens/baixar.png">`}
            </div>
            ` },
        {
            texto: 'CNPJ/CPF',
            elemento: `<span id="cnpj">${cliente?.cnpj || ''}</span>`
        },
        {
            texto: 'Endereço',
            elemento: `<span id="endereco">${cliente?.endereco || ''}</span>`
        },
        {
            texto: 'Bairro',
            elemento: `<span id="bairro">${cliente?.bairro || ''}</span>`
        },
        {
            texto: 'CEP', elemento: `
            <span id="cep">${cliente?.cep || ''}</span>
            ` },
        {
            texto: 'Cidade',
            elemento: `
            <span id="cidade">${cliente?.cidade || ''}</span>
            `
        },
        {
            texto: 'Estado',
            elemento: `
            <span id="estado">${cliente?.estado || ''}</span>
            `
        },
        {
            texto: 'Tipo de Frete',
            elemento: `
            <select id="tipo_de_frete">
                ${['--', 'CIF', 'FOB'].map(op => `<option ${dados_orcam?.tipo_de_frete == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            `
        },
        {
            texto: 'Transportadora',
            elemento: `
                <select class="pedido" id="transportadora">
                    ${oTransportadoras}
                </select>
                `
        },
        {
            elemento: `
            <div class="linha-clientes" style="${vertical}; gap: 5px; width: 100%;">
                <span><b>Escopo / Considerações</b></span>
                <div class="escopo" 
                    id="consideracoes" 
                    contentEditable="true"
                    style="resize: vertical; overflow: auto; text-align: left; text-transform: uppercase;">${dados_orcam?.consideracoes || 'ESCOPO: '}</div>

                <div class="contorno-botoes" style="background-color: #222;">
                    <img src="imagens/anexo.png" style="width: 1.2rem;">
                    <label style="width: 100%;" for="adicionar_levantamento">Anexar levantamento
                        <input type="file" id="adicionar_levantamento" style="display: none;"
                            onchange="${idOrcamento ? `salvarLevantamento('${idOrcamento}')` : 'salvarLevantamento()'}">
                    </label>
                </div>
    
                ${levantamentos}
            </div>`},
        {
            texto: 'Pagamento',
            elemento: `
            <select id="condicoes">
                ${parcelas.map(op => `<option ${dados_orcam?.condicoes == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            ` },
        {
            texto: 'Garantia',
            elemento: `<input id="garantia" value="${dados_orcam?.garantia || 'Conforme tratativa Comercial'}">`
        },
        {
            texto: 'Validade da Proposta',
            elemento: `<div style="${horizontal}; gap: 3px;"><input id="validade" style="width: 3rem;" type="number" value="${dados_orcam?.validade || 30}"> <span>dias</span></div>`
        },
        {
            texto: 'Garantia',
            elemento: `<input id="garantia" value="${dados_orcam?.garantia || 'Conforme tratativa Comercial'}">`
        },
        {
            texto: 'Analista',
            elemento: `<input id="analista" value="${dados_orcam?.analista || acesso.nome_completo}">`
        },
        {
            texto: 'E-mail',
            elemento: `<input id="email_analista" value="${dados_orcam?.email_analista || acesso.email}">`
        },
        {
            texto: 'Telefone',
            elemento: `<input id="telefone_analista" value="${dados_orcam?.telefone_analista || acesso.telefone}">`
        },
        {
            texto: 'Empresa',
            elemento: `
                <select id="emissor">
                    ${['AC SOLUÇÕES', 'IAC', 'HNW', 'HNK'].map(op => `<option ${dados_orcam?.emissor == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            ` }
    ]

    popup({ linhas, botoes, titulo: 'Dados do Cliente', autoDestruicao: ['cliente', 'tecnico'] })

}

async function buscarDadosCliente() {

    const clienteName = document.querySelector('[name="cliente"]')
    if (!clienteName) return

    const omie_cliente = Number(clienteName.id)

    const cliente = await recuperarDado('dados_clientes', omie_cliente)

    const campos = ['cnpj', 'endereco', 'bairro', 'cidade', 'estado', 'cep']
    for (const campo of campos) {
        const el = document.getElementById(campo)
        if (el) el.textContent = cliente?.[campo] || ''
    }

}

async function salvarDadosCliente(idOrcamento = null) {

    overlayAguarde()

    try {

        const orcamentoBase = telaAtiva == 'orcamentos'
            ? await recuperarDado('dados_orcamentos', idOrcamento)
            : baseOrcamento()

        const el = (id) => {
            const elemento = document.getElementById(id)
            return elemento || null
        }

        orcamentoBase.dados_orcam ??= {}

        const omie_cliente = Number(document.querySelector('[name="cliente"]').id)

        orcamentoBase.dados_orcam = {
            ...orcamentoBase.dados_orcam,
            omie_cliente,
            condicoes: el('condicoes').value,
            consideracoes: String(el('consideracoes').textContent).toUpperCase(),
            data: new Date().toLocaleString('pt-BR'),
            garantia: el('garantia').value,
            validade: Number(el('validade').value),
            transportadora: el('transportadora').value,
            tipo_de_frete: el('tipo_de_frete').value,
            emissor: el('emissor').value,
            email_analista: el('email_analista').value,
            analista: el('analista').value,
            telefone_analista: el('telefone_analista').value
        }

        // Se não existir a chave contrato; sequencial fará que o servidor crie;
        orcamentoBase.dados_orcam.contrato ??= 'sequencial'

        // Número do chamado mesmo;
        const chamado = document.querySelector('[name="chamado"]').id
        if (chamado)
            orcamentoBase.dados_orcam.chamado = chamado

        // Se o orçamento é chamado S / N;
        const filtroChamado = el('filtroChamado')
        const ehChamado = filtroChamado.checked ? 'S' : 'N'
        orcamentoBase.chamado = ehChamado

        // Lógica da tag automática;
        const cliente = await recuperarDado('dados_clientes', omie_cliente) || {}
        const empresa = cliente?.snapshots?.empresa
        orcamentoBase.tags ??= {}

        // Remoção local de tags automáticas;
        for (const [idTag, tag] of Object.entries(orcamentoBase.tags))
            if (tag?.auto == 'S')
                delete orcamentoBase.tags[idTag]

        const pesquisa = await pesquisarDB({
            base: 'tags_orcamentos',
            filtros: {
                'nome': { op: '=', value: empresa }
            }
        })

        const tagEscolhida = pesquisa.resultados[0] || null
        if (tagEscolhida)
            orcamentoBase.tags[tagEscolhida.id] = {
                data: new Date().toLocaleDateString(),
                usuario: acesso.usuario,
                auto: 'S'
            }

        if (idOrcamento) {

            await inserirDados({ [idOrcamento]: orcamentoBase }, 'dados_orcamentos')
            enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamentoBase.dados_orcam)
            enviar(`dados_orcamentos/${idOrcamento}/tags`, orcamentoBase.tags)

            const atualizar = orcamentoBase.chamado !== ehChamado
            if (atualizar)
                enviar(`dados_orcamentos/${idOrcamento}/chamado`, ehChamado)

            await abrirAtalhos(idOrcamento)

        }

        baseOrcamento(orcamentoBase)

    } finally {

        removerPopup()

    }

}

function executarLimparCampos() {

    let orcamento = baseOrcamento()
    if (orcamento.dados_orcam) delete orcamento.dados_orcam
    baseOrcamento(orcamento)
    painelClientes()
}

async function abrirDANFE(codOmieNF, tipo, app) {

    overlayAguarde()

    const resposta = await buscarDANFE(codOmieNF, tipo, app)

    if (resposta.err) return popup({ mensagem: `Provavelmente esta nota foi importada via XML e por enquanto não está disponível` })

    removerOverlay()

    try {
        shell.openExternal(resposta)
    } catch {
        window.open(resposta, '_blank')
    }
}

async function buscarDANFE(codOmieNF, tipo, app) {
    try {
        const resposta = await fetch(`${api}/danfe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codOmieNF, tipo, app })
        });

        if (!resposta.ok) return { err: `Falha na busca do PDF no Omie` };

        const texto = await resposta.text();
        if (!texto) return { err: `Falha na busca do PDF no Omie` };

        try {
            return JSON.parse(texto);
        } catch {
            return texto;
        }

    } catch (err) {
        return { err };
    }
}

async function criarDepartamento(idOrcamento) {
    try {
        const response = await fetch(`${api}/criar-departamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idOrcamento })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (err) {
        return { mensagem: err.mensage || 'Falha na criação do departamento' }
    }
}

async function numORC(idOrcamento) {
    try {
        const response = await fetch(`${api}/prox-num-orc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idOrcamento })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }
}

async function criarDepDiretamente(nome) {
    try {
        const response = await fetch(`${api}/criar-departamento-diretamente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, usuario: acesso.usuario })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }
}

// natal() 

function ocultarTemp(balao) {
    balao.style.display = 'none'
    setTimeout(() => {
        balao.style.display = ''
    }, 15000);
}

function natal() {

    const imgs = ['b1', 'b2', 'b3', 'b4', 'b5']
    const especial = `
    <div class="topo-natal">
        ${imgs.map(img => `
            <div class="pendurada" onclick="ocultarTemp(this)">
                <span class="fio"></span>
                <img src="imagens/${img}.png">
            </div>
            `).join('')
        }
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', especial)

    document.querySelectorAll('.pendurada').forEach(el => {
        let timer

        el.addEventListener('mouseenter', () => {
            clearTimeout(timer)
            el.classList.add('balancando')
        })

        el.addEventListener('mouseleave', () => {
            timer = setTimeout(() => {
                el.classList.remove('balancando')
            }, 15000) //15s
        })
    })
}