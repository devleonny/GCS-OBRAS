const botaoRodape = (funcao, texto, img) => `
        <div class="botoesRodape" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>
    `
const modelo = (valor1, valor2) => `
        <div class="modelo">
            <label>${valor1}</label>
            <div style="width: 100%; text-align: left;">${valor2}</div>
        </div>
        `

const labelDestaque = (valor1, valor2) => `
    <div style="${vertical}">
        <div><strong>${valor1}:</strong></div>
        <div style="text-align: left;">${valor2}</div>
    </div>
`

const botao = (valor1, funcao, cor) => `
        <div class="contorno-botoes" style="background-color: ${cor}e3; border: solid 1px ${cor};" onclick="${funcao}">
            <label style="white-space: nowrap;">${valor1}</label>
        </div>
        `
const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
    `
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
    </div>
    `
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
    <div class="btnLateral" onclick="executar('${funcao}')">
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
        popup(mensagem(`<b>Função não encontrada:</b> ${nomeFuncao}`), 'Alerta', true)
    }
}

function criarMenus(chave) {
    telaAtiva = chave

    const atalhos = esquemaBotoes[chave]
    let atalhosString = `
        <div class="nomeUsuario">
            <span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>
        </div>
    `

    for (const atalho of atalhos) atalhosString += criarAtalhoMenu(atalho)

    menus.innerHTML = atalhosString
}

const esquemaBotoes = {
    inicial: [
        { nome: 'Orçamentos', funcao: `rstTelaOrcamentos`, img: 'projeto' },
        { nome: 'Composições', funcao: `telaComposicoes`, img: 'composicoes' },
        { nome: 'Chamados', funcao: `telaChamados`, img: 'chamados' },
        { nome: 'Veículos', funcao: `telaVeiculos`, img: 'veiculo' },
        { nome: 'Reembolsos', funcao: `telaPagamentos`, img: 'reembolso' },
        { nome: 'Estoque', funcao: `telaEstoque`, img: 'estoque' },
        { nome: 'Faturamento NFs', funcao: `telaRelatorio`, img: 'relatorio' },
        { nome: 'RH', funcao: `telaRH`, img: 'gerente' },
        { nome: 'Ocorrências', funcao: `redirecionarChamados`, img: 'LG' },
        { nome: 'Desconectar', funcao: `deslogarUsuario`, img: 'sair' }
    ],
    criarOrcamentos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Dados Cliente', funcao: `painelClientes`, img: 'gerente' },
        { nome: 'Salvar Orçamento', funcao: `enviarDadosOrcamento`, img: 'salvo' },
        { nome: 'Apagar Orçamento', funcao: `apagarOrcamento`, img: 'cancel' },
        { nome: 'Orçamentos', funcao: `rstTelaOrcamentos`, img: 'voltar_2' }
    ],
    criarOrcamentosAluguel: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Dados Cliente', funcao: `painelClientes`, img: 'gerente' },
        { nome: 'Salvar Orçamento', funcao: `enviarDadosAluguel`, img: 'salvo' },
        { nome: 'Apagar Orçamento', funcao: `apagarOrcamentoAluguel`, img: 'cancel' },
        { nome: 'Orçamentos', funcao: `rstTelaOrcamentos`, img: 'voltar_2' }
    ],
    orcamentos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarOrcamentos', img: 'atualizar' },
        { nome: 'Baixar em Excel', funcao: 'excelOrcamentos', img: 'excel' },
        { nome: 'Criar Orçamento', funcao: 'telaCriarOrcamento', img: 'projeto' },
        { nome: 'Orçamento de Aluguel', funcao: 'telaCriarOrcamentoAluguel', img: 'projeto' }
    ],
    composicoes: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarComposicoes', img: 'atualizar' },
        { nome: 'Cadastrar Item', funcao: 'cadastrarItem', img: 'baixar' },
        { nome: 'Baixar em Excel', funcao: 'exportarParaExcel', img: 'excel' },
        { nome: 'Filtrar Campos', funcao: 'abrirFiltros', img: 'pesquisar2' }
    ],
    chamados: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarManutencoes', img: 'atualizar' },
        { nome: 'Criar Manutenção', funcao: 'criarManutencao', img: 'chamados' },
        { nome: 'Baixar em Excel', funcao: 'excelChamados', img: 'excel' }
    ],
    veiculos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarDadosVeiculos', img: 'atualizar' },
        { nome: 'Adicionar Combustível', funcao: 'painelValores', img: 'combustivel' },
        { nome: 'Motoristas', funcao: 'auxMotoristas', img: 'motorista' },
        { nome: 'Veículos', funcao: 'auxVeiculos', img: 'veiculo' },
    ],
    pagamentos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'recuperarPagamentos', img: 'atualizar' },
        { nome: 'Solicitar Pagamento', funcao: 'formularioPagamento', img: 'pagamento' }
    ],
    estoque: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarEstoque', img: 'atualizar' },
        { nome: 'Cadastrar Item', funcao: 'incluirItemEstoque', img: 'baixar' },
        { nome: 'Relatório de Movimentos', funcao: 'relatorioMovimento', img: 'projeto' },
        { nome: 'Baixar em Excel', funcao: `exportarParaExcel`, img: 'excel' },
    ],
    relatorio: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarRelatorio', img: 'atualizar' },
        { nome: 'Baixar em Excel', funcao: 'excelRecebimento', img: 'excel' },
        { nome: 'Limpar Filtros', funcao: 'limparFiltros', img: 'limpar' },
    ],
    rh: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'telaRH', img: 'atualizar' },
        { nome: 'Tabela', funcao: 'telaRHTabela', img: 'todos' },
        { nome: 'Baixar em Excel', funcao: 'rhExcel', img: 'excel' },
        { nome: 'Adicionar Local', funcao: 'adicionarPessoa', img: 'baixar' }
    ],
    agenda: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarAgenda', img: 'atualizar' },
        { nome: 'Distribuição por Funcionário', funcao: 'distribuicaoFuncionario', img: 'gerente' },
        { nome: 'Novo Funcionário', funcao: 'abrirOpcoes', img: 'baixar' },
    ]
}

identificacaoUser()

async function despoluicaoGCS() {

    overlayAguarde(true)

    const divMensagem = document.querySelector('.div-mensagem')

    divMensagem.innerHTML = `
        <div style="${vertical}; gap: 1vh;">
            <label>GCS: Por favor, aguarde...</label>
            <br>
            
            <div id="logs" style="${vertical}; gap: 1vh;"></div>
        </div>
    `

    const logs = document.getElementById('logs')

    logs.insertAdjacentHTML('beforeend', '<label>Criando uma nova Base, 0km, novíssima...</label>')

    const bases = [
        'hierarquia',
        'tags',
        'tags_orcamentos',
        'departamentos_AC',
        'dados_orcamentos',
        'custo_veiculos',
        'motoristas',
        'veiculos',
        'dados_composicoes',
        'dados_clientes',
        'lista_pagamentos',
        'dados_manutencao',
        'dados_categorias_AC',
        'dados_estoque',
        'pessoas'
    ]

    for (const base of bases) {
        await sincronizarDados({ base, resetar: true })
        logs.insertAdjacentHTML('beforeend', `<label>Sincronizando: ${base}</label>`)
    }

    localStorage.setItem('atualizado', true)
    tela.innerHTML = ''
    await telaInicial()
    removerOverlay()

}

async function salvarDepartamento(img) {

    overlayAguarde()

    const input = img.previousElementSibling
    const nome = input.value

    if (!nome) return popup(mensagem('Nome em branco'), 'Alerta', true)

    const resposta = await criarDepDiretamente(nome)

    if (resposta.mensagem) return popup(mensagem(resposta.mensagem), 'Alerta', true)
    input.value = ''
    img.style.display = 'none'

    popup(mensagem('Salvo com successo'), 'Alerta', true)
}

async function respostaSincronizacao(script) {

    let localResposta = document.getElementById('localResposta')

    localResposta.innerHTML = `<img src="gifs/loading.gif" style="width: 5rem;">`

    const resposta = await sincronizar(script)

    localResposta.innerHTML = resposta.status

}

async function identificacaoUser() {

    const bloq = ['cliente', 'técnico', 'visitante']

    if (document.title !== 'GCS') return

    acesso = JSON.parse(localStorage.getItem('acesso'))

    if (document.title == 'Política de Privacidade') return
    if ((acesso && bloq.includes(acesso.permissao)) || !acesso) return retornar()

    const toolbar = `
        <div class="toolbar-top">
            <div style="${horizontal}; gap: 0.5rem;">
                <span class="menu" onclick="mostrarMenus('toggle')">☰</span>
                <span name="titulo"></span>
            </div>
            <div class="interruptor"></div>
            <div class="baloes-top"></div>
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', toolbar)

    dados_setores = await sincronizarDados({ base: 'dados_setores', resetar: true })

    acesso = dados_setores[acesso.usuario]

    if (!acesso || !acesso.permissao || acesso.permissao == 'novo') {
        localStorage.removeItem('acesso')
        return retornar()
    }

    if (acesso.permissao == 'visitante') return redirecionarChamados()

    telaInicial()

    localStorage.setItem('acesso', JSON.stringify(acesso))

    verificarPendencias() // Pendencias de aprovação;

    const modelo = (imagem, funcao, idElemento) => {
        return `
        <div onclick="${funcao}" style="${vertical};">
            <img src="imagens/${imagem}.png">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `
    }

    const permitidosAprovacoes = ['adm', 'diretoria']
    const permitidosProdutos = ['LOGÍSTICA', 'SUPORTE', 'FINANCEIRO']
    const toolbarTop = document.querySelector('.toolbar-top')

    if (!paginasBloqueadas.includes(document.title) && acesso.usuario) {

        const barraStatus = `
            <div class="cabecalhoUsuario">
                <div id="divUsuarios"></div>

                ${modelo('projeto', 'verAprovacoes()', 'contadorPendencias')}
                ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}
                ${permitidosProdutos.includes(acesso.setor) ? modelo('preco', 'precosDesatualizados()', 'contadorProdutos') : ''}

                <img title="Abrir mais 1 aba" src="imagens/aba.png" onclick="maisAba()">

            </div>
        `
        const cabecalhoUsuario = document.querySelector('.cabecalhoUsuario')
        if (cabecalhoUsuario) return cabecalhoUsuario.innerHTML = barraStatus
        toolbarTop.insertAdjacentHTML('beforeend', barraStatus)
    }

    usuariosToolbar()
    precosDesatualizados(true) //Atualiza apenas a quantidade;

}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function mudarStatus(select) {

    const st = select.value

    const img = document.querySelector('[name="imgStatus"]')

    img.src = `imagens/${st}.png`

    alterarUsuario({ campo: 'status', valor: st, usuario: acesso.usuario })

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

    dados_setores = await recuperarDados('dados_setores') || {}
    const user = await recuperarDado('dados_setores', acesso.usuario)

    // Conta quantos usuários estão online (status !== 'offline')
    const usuariosOnline = Object.values(dados_setores)
        .filter(u => u.status && u.status !== 'offline')
        .length

    const indicadorStatus = user?.status || 'offline'

    const usuariosToolbarString = `
        <div class="botaoUsuarios">
            <img name="imgStatus" onclick="painelUsuarios()" src="imagens/${indicadorStatus}.png">
            <label style="font-size: 1.2rem;">${usuariosOnline}</label>
        </div>
    `

    const divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios) divUsuarios.innerHTML = usuariosToolbarString

    const divOnline = document.querySelector('.divOnline')
    if (divOnline) painelUsuarios()
}

async function configs() {

    dados_setores = await sincronizarDados({ base: 'dados_setores', overlay: true })

    let linhas = ''
    const listas = {
        permissoes: ['', 'adm', 'user', 'visitante', 'analista', 'gerente', 'coordenacao', 'diretoria', 'editor', 'log', 'qualidade', 'novo'],
        setores: ['', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO', 'RH', 'CHAMADOS', 'SUPORTE', 'POC']
    }

    const organizados = Object
        .values(dados_setores)
        .sort((a, b) =>
            (a.usuario || '').localeCompare(b.usuario || '', undefined, { sensitivity: 'base' })
        )

    const tdPreenchida = (coluna, opcoes, usuario) => `
        <td>
            <select class="opcoesSelect" onchange="alterarUsuario({campo: '${coluna}', usuario: '${usuario}', select: this})" style="cursor: pointer;">${opcoes}</select>
        </td>
    `

    for (const dados of organizados) {

        const { permissao, setor, usuario } = dados

        const opcoesPermissao = listas.permissoes
            .map(p => `<option value="${p}" ${permissao == p ? 'selected' : ''}>${p}</option>`).join('')

        const opcoesSetores = listas.setores
            .map(s => `<option value="${s}" ${setor == s ? 'selected' : ''}>${s}</option>`).join('')

        linhas += `
        <tr>
            <td style="text-align: left;">${usuario}</td>
            ${tdPreenchida('permissao', opcoesPermissao, usuario)}
            ${tdPreenchida('setor', opcoesSetores, usuario)}
        </tr>
        `
    }

    let ths = ''
    let tbusca = ''
    let cabecalhos = ['Usuário', 'Permissão', 'Setores']
    cabecalhos.forEach((cabecalho, i) => {
        ths += `<th>${cabecalho}</th>`
        tbusca += `<th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico(${i}, this.textContent, 'tbodyUsuarios')"></th>`
    })

    const tabela = `
        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${tbusca}</tr>
                    </thead>
                    <tbody id="tbodyUsuarios">${linhas}</tbody>
                </table>
                </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 0.5rem;">
            <label style="font-size: 1.2rem;">Gestão de Usuários</label>
            <hr style="width: 100%;">
            ${tabela}
        </div>
    `
    removerPopup()
    popup(acumulado, 'Configurações')

}

async function alterarUsuario({ campo, usuario, select, valor }) {

    valor = select ? select.value : valor

    const alteracao = await configuracoes(usuario, campo, valor) // Se alterar no servidor, altera localmente;

    if (alteracao?.success) {
        dados_setores[usuario][campo] = select ? select.value : valor
    } else {
        popup(mensagem(`Não foi possível alterar: ${alteracao?.erro || 'Tente novamente mais tarde'}`), 'ALERTA', true)
        if (select) select.value = dados_setores[usuario][campo] // Devolve a informação anterior pro elemento;
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

async function exportarParaExcel() {
    try {
        overlayAguarde();

        const idTabela = telaAtiva == 'estoque' ? 'tabela_estoque' : 'tabela_composicoes'

        if (typeof ExcelJS === 'undefined') {
            throw new Error('Biblioteca ExcelJS não está carregada');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dados');

        const tabela = document.getElementById(idTabela);
        if (!tabela) throw new Error('Tabela de estoque não encontrada');

        const headers = [];
        tabela.querySelectorAll('th').forEach((th, index) => {
            if (index > 0) {
                headers.push(th.textContent.trim());
            }
        });

        worksheet.addRow(headers);

        tabela.querySelectorAll('tbody tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td').forEach((td, index) => {

                if (index > 0) {
                    const input = td.querySelector('input');
                    const select = td.querySelector('select');

                    if (input) {
                        rowData.push(input.value);
                    } else if (select) {
                        rowData.push(select.value);
                    } else {
                        rowData.push(td.textContent.trim());
                    }
                }
            });
            if (rowData.length > 0) {
                worksheet.addRow(rowData);
            }
        });

        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${telaAtiva}_${data}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        removerOverlay();
    } catch (erro) {
        console.error("Erro ao exportar:", erro);
        removerOverlay();
        popup(mensagem(erro), 'Alerta', true);
    }
}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function irPdf(orcam_, emAnalise) {

    const orcamento = dados_orcamentos[orcam_]
    orcamento.emAnalise = emAnalise

    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('pdf.html', '_blank')

}

async function recuperarClientes() {

    await sincronizarDados({ base: 'dados_clientes', overlay: true })

}

async function continuar() {
    if (telaAtiva == 'composicoes') {
        await telaComposicoes()

    } else if (telaAtiva == 'telaCriarOrcamentos') {
        await tabelaProdutosOrcamentos()
        await totalOrcamento()

    } else if (telaAtiva == 'telaCriarOrcamentoAluguel') {
        await criarOrcamentoAluguel()

    }
}

function pesquisarGenerico(indice, texto, idTbody) {

    filtrosPesquisa[idTbody] ??= {}
    const filtroAtual = filtrosPesquisa[idTbody]

    filtroAtual[indice] = String(texto)
        .toLowerCase()
        .replace(/\./g, '')
        .trim()

    const tbody = document.getElementById(idTbody)
    if (!tbody) return

    const table = tbody.closest('table')
    const ths = table?.querySelectorAll('thead tr')[1]?.querySelectorAll('th') || []

    ths.forEach((th, col) => {

        const valorFiltro = filtroAtual[col] || ''

        th.style.backgroundColor = valorFiltro ? '#ffe48f' : 'white'

        if (col == indice) {
            th.style.backgroundColor = texto ? '#ffe48f' : 'white'
            return
        }

        if (valorFiltro) {
            th.textContent = valorFiltro
        }
    })

    const trs = tbody.querySelectorAll('tr')

    function extrairTexto(td) {
        if (!td) return ''

        let partes = []
        partes.push(td.textContent || '')

        td.querySelectorAll('input').forEach(i => partes.push(i.value || ''))
        td.querySelectorAll('textarea').forEach(t => partes.push(t.value || ''))
        td.querySelectorAll('select').forEach(s => {
            const opt = s.options[s.selectedIndex]
            partes.push(opt ? opt.text : s.value)
        })

        return partes.join(' ').replace(/\s+/g, ' ').trim()
    }

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td')
        let mostrar = true

        for (const [col, filtroTexto] of Object.entries(filtroAtual)) {
            if (!filtroTexto) continue

            const conteudo = extrairTexto(tds[col])
                .toLowerCase()
                .replace(/\./g, '')
                .trim()

            if (!conteudo.includes(filtroTexto)) {
                mostrar = false
                break
            }
        }

        tr.style.display = mostrar ? '' : 'none'
    }
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
        popup(mensagem(`Erro ao fazer upload: ${error.message}`), 'ALERTA', true)
    }
}

async function excluirLevantamentoStatus(idAnexo, idOrcamento) {

    overlayAguarde()

    const orcamento = idOrcamento ? await recuperarDado('dados_orcamentos', id_orcam) : baseOrcamento()

    delete orcamento.levantamentos[idAnexo]

    if (idOrcamento) {
        deletar(`dados_orcamentos/${id_orcam}/levantamentos/${idAnexo}`)
        await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    } else {
        baseOrcamento(orcamento)
    }

    // Retornar as telas específicas;
    const painelC = document.querySelector('.painel-clientes')
    if (painelC) return await painelClientes(idOrcamento)

    const painelH = document.querySelector('.painel-historico')
    if (painelH) return await abrirEsquema(idOrcamento)

    if (idOrcamento) return await abrirEsquema(idOrcamento)

}

function filtrarAAZ(coluna, id) {

    let el = document.getElementById(id)
    let tbody = el.tagName === "TBODY" ? el : el.tBodies[0]
    if (!tbody) return

    let linhas = Array.from(tbody.rows)
    let ascendente = (el.dataset.order ?? "desc") !== "asc"

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna])
        let valorB = capturarValorCelula(b.cells[coluna])

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
    let entrada = celula.querySelector('input') || celula.querySelector('textarea') || celula.querySelector('select')
    if (entrada) {
        return entrada.value.toLowerCase();
    }

    let valor = celula.innerText.toLowerCase();

    if (/^r\$\s[\d.,]+$/.test(valor)) {
        valor = valor.replace("r$", "").trim().replace(/\./g, "").replace(",", ".");
        return parseFloat(valor);
    }

    return valor;
}

async function painelUsuarios() {

    const stringUsuarios = {}
    const organizados = Object
        .entries(dados_setores)
        .sort((a, b) => a[0].localeCompare(b[0]))

    for (const [usuario, objeto] of organizados) {

        if (objeto.permissao == 'novo') continue

        const status = objeto?.status || 'offline'
        if (!stringUsuarios[status]) stringUsuarios[status] = { quantidade: 0, linhas: '' }

        stringUsuarios[status].quantidade++
        stringUsuarios[status].linhas += `
            <div class="usuarioOnline">
                <img src="imagens/${status}.png" style="width: 1.5rem;">
                <label>${usuario}</label>
                <label style="font-size: 0.6rem;"><b>${objeto?.permissao || '??'}</b></label>
            </div>
        `
    }

    let info = ''

    // ordena as chaves colocando "offline" no final
    const chavesOrdenadas = Object.keys(stringUsuarios).sort((a, b) => {
        if (a === 'offline') return 1
        if (b === 'offline') return -1
        return a.localeCompare(b)
    })

    for (const st of chavesOrdenadas) {
        const dados = stringUsuarios[st]
        info += `
            <label><strong>${st}</strong> ${dados.quantidade}</label>
            ${dados.linhas}
        `
    }

    const divOnline = document.querySelector('.divOnline')
    if (divOnline) return divOnline.innerHTML = info

    const indicadorStatus = acesso?.status || 'offline'
    const statusOpcoes = ['online', 'Em almoço', 'Não perturbe', 'Em reunião', 'Apenas Whatsapp']
    if (acesso?.permissao == 'adm') statusOpcoes.push('Invisível')

    const acumulado = `
        <div class="conteinerOnline">
            <span>Alterar Status</span>
            <select class="opcoesSelect" onchange="mudarStatus(this)">
                ${statusOpcoes.map(op => `<option ${indicadorStatus == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            <div class="divOnline">
                ${info}
            </div>
        </div>
    `

    popup(acumulado, 'Usuários', true)
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

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">

            <div style="${horizontal}; gap: 1rem;">
                <span>Qual APP deve ser relançado?</span>
                <select class="opcoesSelect" id="app">
                    ${['IAC', 'AC', 'HNK'].map(op => `<option>${op}</option>`).join('')}
                </select>
            </div>
            <hr style="width: 100%;">
            <button onclick="confirmarRelancamento('${idPagamento}')">Confirmar</button>
        </div>
    `
    popup(acumulado, 'Escolha o APP', true)
}

async function confirmarRelancamento(idPagamento) {

    const app = document.getElementById('app').value

    removerPopup()
    overlayAguarde()

    let pagamento = await recuperarDado('lista_pagamentos', idPagamento)

    pagamento.app = app

    await enviar(`lista_pagamentos/${idPagamento}/app`, app)

    const resposta = await lancarPagamento({ pagamento, dataFixa: true })

    pagamento.status = 'Processando...'

    await inserirDados({ [idPagamento]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(idPagamento)

    const textoPrincipal = resposta?.objeto?.descricao_status || resposta?.mensagem || JSON.stringify(resposta)
    const infoAdicional = resposta?.objeto?.exclusaoPagamento || ''
    const texto = `
        <div style="${vertical}; gap: 5px; text-align: left;">
            <span>${textoPrincipal}</span>
            <span>${infoAdicional}</span>
        </div>
    `
    popup(mensagem(texto, 'imagens/atualizar.png'), 'Resposta', true)

    telaPagamentos()

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
                popup(mensagem('Finalizado', 'imagens/concluido.png'), 'Alerta', true)
                resolve(data);
            })
            .catch(err => {
                console.log(err)
                popup(mensagem('Finalizado'), 'Alerta', true)
                reject(err)
            })
    })
}

async function lancarPagamento({ pagamento, call, dataFixa }) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/lancar_pagamento`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagamento, call, dataFixa })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                data = JSON.parse(data)
                resolve(data)
            })
            .catch(err => reject(err))
    })
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
    dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_clientes = await recuperarDados('dados_clientes') || {}

    let guia = {
        pendente: '#ff8c1b',
        todos: '#bfbfbfff'
    }

    let cabecalhos = ['Chamado', 'Cliente', 'Total Original <br>[s/desc ou acres]', 'Total Geral', '%', 'Localização', 'Usuário', 'Aprovação', 'Comentário', 'Detalhes']
    let tabelas = {
        pendente: { linhas: '' },
        todos: { linhas: '' }
    }

    let ths = ''
    let tsh = ''
    cabecalhos.forEach((cabecalho, i) => {
        ths += `<th>${cabecalho}</th>`

        cabecalho == 'Detalhes'
            ? tsh += '<th style="background-color: white;"></th>'
            : tsh += `
            <th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico(${i}, this.textContent, 'tbodyPendencias')"></th>
        `
    })

    const organizado = Object
        .entries(dados_orcamentos)
        .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0))

    for (let [idOrcamento, orcamento] of organizado) {

        if (!orcamento.aprovacao) continue
        if (!orcamento.dados_orcam) continue

        const dados_orcam = orcamento.dados_orcam || {}
        const aprovacao = orcamento.aprovacao
        const status = aprovacao?.status || 'desconhecido'
        const porcentagemDiferenca = (((orcamento.total_geral - orcamento.total_bruto) / orcamento.total_bruto) * 100).toFixed(2)
        const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
        const cliente = dados_clientes?.[omie_cliente] || {}

        tabelas[status == 'pendente' ? 'pendente' : 'todos'].linhas += `
        <tr>
            <td style="text-align: left;">
                ${dados_orcam?.chamado || ''}<br>
                ${dados_orcam?.contrato || ''}<br>
                ${dados_orcam?.data || ''}
            </td>
            <td style="text-align: left;">${cliente?.nome || '--'}</td>
            <td style="white-space: nowrap;">${dinheiro(orcamento.total_bruto)}</td>
            <td style="white-space: nowrap;">${dinheiro(orcamento.total_geral)}</td>
            <td><label class="labelAprovacao" style="background-color: ${porcentagemDiferenca > 0 ? 'green' : '#B12425'}">${porcentagemDiferenca}%</label></td>
            <td>${cliente?.cidade || ''}</td>
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

    let tabelasString = ''
    for (let [tabela, objeto] of Object.entries(tabelas)) {
        if (objeto.linhas == '') continue
        tabelasString += `
        <br>
        <hr>
        <br>
        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead style="background-color: ${guia[tabela]};">
                        <tr>${ths}</tr>
                        ${tabela == 'todos' ? `<tr>${tsh}</tr>` : ''}
                    </thead>
                    <tbody ${tabela == 'todos' ? 'id="tbodyPendencias"' : ''}>${objeto.linhas}</tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        `
    }

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 5px;">

            <label style="font-size: 1.2rem;">Fila de Aprovação</label>

            ${tabelasString}

        </div>
    `
    popup(acumulado, 'Aprovações de Orçamento', true)
}

async function verificarPendencias() {

    if (!navigator.onLine) return

    dados_orcamentos = await sincronizarDados({ base: 'dados_orcamentos' })

    let contador = 0

    for ([idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {
        if (orcamento.aprovacao && orcamento.aprovacao.status == 'pendente') contador++
    }

    let contadorPendencias = document.getElementById('contadorPendencias')
    if (contadorPendencias) {
        contadorPendencias.style.display = contador == 0 ? 'none' : 'flex'
        contadorPendencias.textContent = contador
    }
}

async function verPedidoAprovacao(idOrcamento) {

    const permissao = acesso.permissao
    const pessoasPermitidas = ['adm', 'diretoria']
    if (!pessoasPermitidas.includes(permissao)) return popup(mensagem('Você não tem acesso'), 'AVISO', true)

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

    const acumulado = `
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

    popup(acumulado, 'Detalhes', true)

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

    let justificativa = botao.parentElement.parentElement.querySelector('textarea').value
    let dados = {
        usuario: acesso.usuario,
        data: new Date().toLocaleString(),
        status,
        justificativa
    }

    const orcamento = dados_orcamentos[idOrcamento] || {}

    orcamento.aprovacao = {
        ...dados_orcamentos[idOrcamento].aprovacao,
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

async function atualizarBaseClientes() {
    await sincronizarDados({ base: 'dados_clientes' })
    await sincronizarDados({ base: 'dados_ocorrencias' })
    await auxDepartamentos()
}

async function painelClientes(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const orcamentoBase = idOrcamento ? orcamento : baseOrcamento()

    const dados_orcam = orcamentoBase?.dados_orcam || {}
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

    const botoes = [
        { texto: 'Salvar Dados', img: 'concluido', funcao: `salvarDadosCliente()` },
        { texto: 'Atualizar', img: 'atualizar', funcao: `atualizarBaseClientes()` },
    ]

    if (idOrcamento) botoes.push({ texto: 'Limpar Campos', img: 'limpar', funcao: 'executarLimparCampos()' })

    const linhas = [
        {
            texto: 'Chamado',
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <span 
                        class="opcoes" 
                        name="chamado"
                        ${dados_orcam?.chamado ? `id="${dados_orcam?.chamado}"` : ''}
                        onclick="cxOpcoes('chamado', 'dados_ocorrencias', ['id'])">
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
                <input id="filtroChamado" ${orcamentoBase?.chamado ? 'checked' : ''} ${styChek} type="checkbox">
            </div>
            `
        },
        {
            texto: 'Cliente',
            elemento: `
            <div style="${horizontal}; gap: 3px">
                ${bloq
                    ? `<img src="imagens/proibido.png">` : ''}
                <span ${dados_orcam.omie_cliente
                    ? `id="${dados_orcam.omie_cliente}"`
                    : ''} 
                    class="opcoes" 
                    name="cliente" 
                    ${bloq ? '' : `onclick="cxOpcoes('cliente', 'dados_clientes', ['nome', 'bairro', 'cnpj'], 'buscarDadosCliente()')"`}>
                        ${cliente?.nome || 'Selecione'}
                    </span>
            </div>
            ` },
        {
            texto: 'CNPJ/CPF',
            elemento: `<span id="cnpj">${cliente?.cnpj || ''}</span>`
        },
        {
            texto: 'Endereço',
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
            elemento: `<input type="text" id="transportadora" value="${dados_orcam?.transportadora || '--'}">`
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

    const form = new formulario({ linhas, botoes, titulo: 'Dados do Cliente' })
    form.abrirFormulario()

}

async function buscarDadosCliente() {

    const clienteName = document.querySelector('[name="cliente"]')
    if (!clienteName) return

    const omie_cliente = clienteName.id

    const cliente = await recuperarDado('dados_clientes', omie_cliente)
    const campos = ['cnpj', 'bairro', 'cidade', 'estado', 'cep']
    for (const campo of campos) {
        const el = document.getElementById(campo)
        if (el) el.textContent = cliente?.[campo] || ''
    }

}

async function salvarDadosCliente() {

    overlayAguarde()

    const orcamentoBase = telaAtiva == 'orcamentos' ? await recuperarDado('dados_orcamentos', id_orcam) : baseOrcamento()

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
    if (!orcamentoBase.dados_orcam.contrato) orcamentoBase.dados_orcam.contrato = 'sequencial'

    const chamado = document.querySelector('[name="chamado"]').id
    if (chamado) orcamentoBase.dados_orcam.chamado = chamado

    const filtroChamado = el('filtroChamado')
    orcamentoBase.chamado = filtroChamado.checked ? 'S' : 'N'

    if (telaAtiva == 'orcamentos') {
        enviar(`dados_orcamentos/${id_orcam}/dados_orcam`, orcamentoBase.dados_orcam)
        enviar(`dados_orcamentos/${id_orcam}/chamado`, filtroChamado.checked)
        await inserirDados({ [id_orcam]: orcamentoBase }, 'dados_orcamentos')
        await telaOrcamentos()
        removerPopup()
        abrirAtalhos(id_orcam)
        return
    }

    baseOrcamento(orcamentoBase)
    removerPopup()

    const orcamentoPadrao = document.getElementById('orcamento_padrao')
    if (!orcamentoPadrao) return

    if (orcamentoBase.lpu_ativa === 'MODALIDADE LIVRE') {
        total_v2()
    } else {
        if (String(telaAtiva).includes('Aluguel')) {
            await total()
        } else {
            await totalOrcamento()
        }
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

    console.log(resposta)

    if (resposta.err) return popup(mensagem(`Provavelmente esta nota foi importada via XML e por enquanto não está disponível`), 'Alerta', true)

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

async function vincularAPI({ idMaster, idSlave }) {
    try {
        const response = await fetch(`${api}/vincular`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idMaster, idSlave })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
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

async function auxDepartamentos() {

    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    dados_orcamentos = await recuperarDados('dados_orcamentos')
    dados_clientes = await recuperarDados('dados_clientes')
    departamentos_AC = await sincronizarDados({ base: 'departamentos_AC' })

    // Map por descrição (mais rápido que ficar iterando)
    for (const dep of Object.values(departamentos_AC)) {
        depPorDesc[dep.descricao] = dep
    }

    // Map orçamento por número final (chamado ou contrato)
    const orcPorNum = {}
    for (const [idOrcamento, orc] of Object.entries(dados_orcamentos)) {
        const numFinal = orc?.dados_orcam?.chamado || orc?.dados_orcam?.contrato
        if (!numFinal) continue

        orcPorNum[numFinal] ??= {}
        orcPorNum[numFinal].ids ??= []
        orcPorNum[numFinal].ids.push(idOrcamento)
    }

    // Processa departamentos
    for (const dep of Object.values(departamentos_AC)) {

        const nomeDep = dep.descricao

        // Se existe ocorrência com o nome do dep
        const ocorrencia = dados_ocorrencias[nomeDep]
        if (ocorrencia) {
            const cliente = dados_clientes[ocorrencia?.unidade]
            if (cliente) dep.cliente = cliente
        }

        // Se existe orçamento com o nome do dep
        const orcamento = orcPorNum[nomeDep]
        if (orcamento) {
            // Listagem de Ids, Orçamentos
            dep.ids = orcamento.ids

            const codOmie = orcamento?.dados_orcam?.omie_cliente
            const cliente = dados_clientes[codOmie]

            if (cliente) dep.cliente = cliente

            dep.total = dinheiro(orcamento?.total_geral)
        }
    }

    // Atualiza banco
    await inserirDados(departamentos_AC, 'departamentos_AC')
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