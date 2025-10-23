let filtrosOrcamento = {}
let filtroPDA = {}
let dados_clientes = {}
let intervaloCompleto
let intervaloCurto
let filtro;
let naoArquivados = true
let meusOrcamentos = true
let auxiliarFaturamento = {}
let baloes = document.querySelector('.baloes-top')
let layout = null

const meses = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
}

async function atualizarOrcamentos() {

    await sincronizarDados('dados_orcamentos')
    await sincronizarDados('dados_composicoes')
    await sincronizarDados('dados_clientes')
    await telaOrcamentos()

}

function filtrarOrcamentos({ ultimoStatus, col, texto } = {}) {

    if (ultimoStatus) filtro = ultimoStatus;

    if (col !== undefined && col !== null) {
        filtrosOrcamento[col] = String(texto).toLowerCase().trim();
    }

    const trs = document.querySelectorAll('#linhas tr');
    const lucratividade = String(document.querySelector('[name="lucratividade"]').value);
    const range = lucratividade !== '--' ? lucratividade.match(/\d+/g).map(Number) : null;
    const [n1, n2] = range || [];

    let totais = { TODOS: 0 };
    let visiveis = { TODOS: 0 };
    let listaStatus = new Set(['TODOS']);

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td');
        const status = tds[1].querySelector('select').value;

        // inicializa contadores
        if (!(status in totais)) {
            totais[status] = 0;
            visiveis[status] = 0;
        }

        // conta sempre no total
        totais[status]++;
        totais['TODOS']++;
        listaStatus.add(status);

        // verifica filtros
        let mostrarLinha = true;

        for (const [col, filtroTexto] of Object.entries(filtrosOrcamento)) {

            if (filtroTexto && col < tds.length) {
                const el = tds[col].querySelector('input')
                    || tds[col].querySelector('textarea')
                    || tds[col].querySelector('select')
                    || tds[col].textContent;
                const conteudo = el.value ? el.value : el;
                const textoCampo = String(conteudo).toLowerCase().trim();

                if (!textoCampo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        if (range) {
            const lc = Number(tds[8].querySelector('input').value);
            if (!(lc >= n1 && lc <= n2)) mostrarLinha = false;
        }

        if (filtro) {
            mostrarLinha = mostrarLinha && (status === filtro || filtro === 'TODOS');
        }

        // se passou no filtro → incrementa visíveis
        if (mostrarLinha) {
            visiveis[status]++;
            visiveis['TODOS']++;
        }

        tr.style.display = mostrarLinha ? 'table-row' : 'none';
    }

    // renderiza toolbar
    const toolbar = document.getElementById('toolbar');
    toolbar.innerHTML = '';

    const tempFluxograma = ['TODOS', ...fluxograma]

    for (const st of tempFluxograma) {
        if (!listaStatus.has(st)) continue;
        const ativo = filtro ? filtro === st : st === 'TODOS';
        const opacity = ativo ? 1 : 0.5;

        toolbar.insertAdjacentHTML('beforeend', `
            <div style="opacity:${opacity}" class="aba-toolbar"
                 onclick="filtrarOrcamentos({ultimoStatus:'${st}'})">
                <label>${inicialMaiuscula(st)}</label>
                <span>${filtro == st ? visiveis[st] : totais[st]}</span>
            </div>
        `);
    }
}

async function telaOrcamentos(semOverlay) {

    funcaoTela = 'telaOrcamentos'

    if (!semOverlay) overlayAguarde()

    let cabecs = ['Data & LPU', 'Status', 'Pedido', 'Notas', 'Chamado & Cliente', 'Cidade', 'Analista', 'Responsáveis', 'Lc %', 'Checklist', 'Valor', 'Ações']
    let ths = ''
    let tsh = ''
    cabecs.forEach((cab, i) => {

        ths += `<th style="text-align: center;">${cab}</th>`

        if (cab == 'Lc %') {
            tsh += `
                <th style="background-color: white;">
                    <select name="lucratividade" onchange="filtrarOrcamentos()">${['--', '0% a 35%', '36% a 50%', '51% a 70%', '71% a 100%']
                    .map(op => `<option>${op}</option>`)
                    .join('')
                }</select>
                </th>
            `
        } else {
            tsh += `<th name="col_${i}" oninput="filtrarOrcamentos({col: ${i}, texto: this.textContent})" style="background-color: white; text-align: left;" contentEditable="true"></th>`
        }
    })

    const acumulado = `
        <div id="toolbar"></div>
        <div id="tabelaOrcamento" style="${vertical}; width: 95vw;">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${tsh}</tr>
                    </thead>
                    <tbody id="linhas"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
        `

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento || layout == 'pda') tela.innerHTML = acumulado
    layout = 'tradicional'

    dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_clientes = await recuperarDados('dados_clientes') || {}

    let idsAtivos = []
    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {
        if (orcamento.origem !== origem) continue
        if (naoArquivados && orcamento.arquivado) continue
        if (!naoArquivados && !orcamento.arquivado) continue
        if (!meusOrcamentos && orcamento.dados_orcam.analista !== acesso.nome_completo) continue

        idsAtivos.push(idOrcamento)
        criarLinhaOrcamento(idOrcamento, orcamento)
    }

    const linhas = document.getElementById('linhas')
    const trs = linhas.querySelectorAll('tr')
    const idsAtuais = Array.from(trs).map(tr => tr.id).filter(id => id)
    for (const idAtual of idsAtuais) {
        if (!idsAtivos.includes(idAtual)) document.getElementById(idAtual).remove()
    }

    filtrarOrcamentos()

    criarMenus('orcamentos')

    for (const [col, termo] of Object.entries(filtrosOrcamento)) {
        const th = document.querySelector(`[name=col_${col}]`)
        if (th) th.textContent = termo
    }

    if (!semOverlay) removerOverlay()

}

function criarLinhaOrcamento(idOrcamento, orcamento) {

    const dados_orcam = orcamento.dados_orcam
    if (!dados_orcam) return

    const cliente = dados_clientes?.[dados_orcam.omie_cliente] || {}
    let labels = {
        PEDIDO: '',
        FATURADO: ''
    }

    for (const [, historico] of Object.entries(orcamento?.status?.historico || {})) {

        if (labels[historico.status] == undefined) continue
        if (historico.tipo == 'Remessa') continue

        const valor1 = historico.tipo
        const valor2 = historico.status == 'FATURADO' ? historico.nf : historico.pedido
        const valor3 = conversor(historico.valor)

        labels[historico.status] += `
            <div class="etiqueta_pedidos"> 
                <label>${valor1}</label>
                <label><b>${valor2}</b></label>
                ${historico.valor ? `<label><b>${dinheiro(valor3)}</b></label>` : ''}
            </div>
            `
    }

    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const totalCustos = Object.values(orcamento?.dados_custos || {}).reduce((acc, val) => acc + val, 0)
    const lucratividade = orcamento.total_geral - totalCustos
    const lucratividadePorcentagem = Number(((lucratividade / orcamento.total_geral) * 100).toFixed(0))

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    const tds = `
        <td>
            <label text-align: left;">
                <b>${orcamento.lpu_ativa}</b><br>
                ${new Date(dados_orcam.data).toLocaleString('pt-BR')}
            </label>
        </td>
        <td>
            <select class="opcoesSelect" onchange="alterar_status(this, '${idOrcamento}')">
                ${opcoes}
            </select>
        </td>
        <td>${labels.PEDIDO}</td>
        <td>${labels.FATURADO}</td>
        <td>
            <div style="${vertical}; text-align: left;">
                ${(acesso.permissao && dados_orcam.cliente_selecionado) ? `*<img onclick="painelAlteracaoCliente('${idOrcamento}')" src="gifs/alerta.gif" style="width: 1.5vw; cursor: pointer;">` : ''}
                <div style="text-align: left; display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    <label><b>${dados_orcam.contrato}</b></label>
                    <label>${cliente?.nome || ''}</label>
                </div>
            </div>
        </td>
        <td>${cliente?.cidade || ''}</td>
        <td style="text-align: left;">${dados_orcam?.analista || ''}</td>
        <td>${responsaveis}</td>
        <td><input style="display: none;" value="${lucratividadePorcentagem}">${divPorcentagem(lucratividadePorcentagem)}</td>
        <td>${orcamento?.checklist?.andamento ? divPorcentagem(orcamento.checklist.andamento) : ''}</td>
        <td style="white-space: nowrap;">${dinheiro(orcamento.total_geral)}</td>
        <td style="text-align: center;" onclick="abrirAtalhos('${idOrcamento}')">
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;">
        </td>
        `

    const linhaExistente = document.getElementById(idOrcamento)
    if (linhaExistente) return linhaExistente.innerHTML = tds

    const novaLinha = `
        <tr id="${idOrcamento}">
            ${tds}
        </tr>
    `
    document.getElementById('linhas').insertAdjacentHTML('beforeend', novaLinha)

}

async function painelAlteracaoCliente(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const dados_clientes = await recuperarDados('dados_clientes')
    const opcoes = Object.entries(dados_clientes)
        .map(([codOmie, cliente]) => `<option value="${codOmie}">${cliente.cnpj} - ${cliente.nome}</option>`)
        .join('')

    const acumulado = `
    <div style="display: flex; align-items: start; flex-direction: column; justify-content: center; padding: 2vw; background-color: #d2d2d2;">

        ${modelo('Cliente', orcamento.dados_orcam.cliente_selecionado)}
        ${modelo('Cliente', orcamento.dados_orcam.cnpj)}
        ${modelo('Cliente', orcamento.dados_orcam.cidade)}

        <hr style="width: 100%;">

        <label for="clientes">Clientes Omie</label>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <input style="padding: 5px; width: 100%; border-radius: 3px;" list="clientes" id="cliente">
            <datalist id="clientes">${opcoes}</datalist>
            ${botao('Salvar', `associarClienteOrcamento('${idOrcamento}')`, 'green')}
        </div>

    </div>
    `

    popup(acumulado, 'ATUALIZAR CLIENTE')
}

async function associarClienteOrcamento(idOrcamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const codOmie = document.getElementById('cliente').value

    orcamento.dados_orcam.omie_cliente = Number(codOmie)
    delete orcamento.dados_orcam.cliente_selecionado
    delete orcamento.dados_orcam.cidade
    delete orcamento.dados_orcam.cnpj
    delete orcamento.dados_orcam.estado
    delete orcamento.dados_orcam.cep
    delete orcamento.dados_orcam.bairro
    delete orcamento.dados_orcam.cliente_selecionado

    enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamento.dados_orcam)

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    filtrarOrcamentos()

    removerPopup()

}

async function editar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    if (orcamentoBase.aprovacao) delete orcamentoBase.aprovacao

    await baseOrcamento(orcamentoBase)

    removerPopup()

    orcamentoBase.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function duplicar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    let novoOrcamento = {}

    novoOrcamento.dados_orcam = orcamentoBase.dados_orcam
    novoOrcamento.dados_composicoes = orcamentoBase.dados_composicoes
    novoOrcamento.lpu_ativa = orcamentoBase.lpu_ativa
    novoOrcamento.dados_orcam.contrato = ''
    novoOrcamento.dados_orcam.analista = acesso.nome_completo
    novoOrcamento.dados_orcam.email_analista = acesso.email
    novoOrcamento.dados_orcam.telefone_analista = acesso.telefone

    baseOrcamento(novoOrcamento)

    removerPopup()

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function excelOrcamentos() {

    overlayAguarde()

    try {

        const response = await fetch(`${api}/orcamentosRelatorio`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio de Orcamentos.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

    } catch (err) {
        popup(mensagem(err), 'Erro ao baixar Excel', true)
    }

    removerOverlay()

}

async function telaPDA() {

    mostrarMenus(false)

    const colunas = [
        'DATA',
        'CHAMADO',
        'LOJA',
        'STATUS',
        'RESPONSÁVEL',
        'OBSERVAÇÃO',
        'TOTAL',
        'DATA DA SAÍDA',
        'PREVISÃO DE ENTREGA',
        'DATA DE ENTREGA',
        'TRANSPORTE',
        'DETALHES'
    ]

    let ths = '', pesquisa = ''

    colunas.forEach((op, i) => {
        ths += `
        <th>
            <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 1rem;">
                <span>${op}</span>
                <img onclick="filtrarAAZ('${i}', 'linhas')" src="imagens/down.png" style="width: 1rem;">
            </div>
        </th>`
        pesquisa += `<th oninput="pesquisarGenerico('${i}', this.textContent, filtroPDA, 'linhas')" style="background-color: white; text-align: left;" contentEditable="true"></th>`
    })

    const acumulado = `
        <div style="${vertical}; width: 90vw;">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/planilha.png" style="width: 2rem;">
                    <span style="font-size: 1rem;">Layout PDA</span>
                </div>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="linhas"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const tabelaExistente = document.querySelector('.div-tabela')
    if (!tabelaExistente || layout == 'tradicional') tela.innerHTML = acumulado
    layout = 'pda'

    dados_orcamentos = await recuperarDados('dados_orcamentos')
    dados_clientes = await recuperarDados('dados_clientes')

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos || {}).reverse()) {

        if (orcamento.origem !== origem) {
            const trExistente = document.getElementById(idOrcamento)
            if (trExistente) trExistente.remove()
            continue
        }

        criarLinhaPDA(idOrcamento, orcamento)

    }

    criarMenus('pda')

}

function criarLinhaPDA(idOrcamento, orcamento) {

    const clienteOmie = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[clienteOmie] || {}
    const data = orcamento?.dados_orcam?.data ? new Date(orcamento.dados_orcam.data).toLocaleString() : '--'

    const transportadoras = ['', 'CORREIOS', 'BRAEX', 'JADLOG', 'JAMEF', 'VENDA DIRETA', 'AÉREO']
        .map(op => `<option ${orcamento?.transportadora == op ? 'selected' : ''}>${op}</option>`)
        .join('')

    const datas = (campo) => {

        const data = orcamento?.[campo] || ''
        return `
            <td>
                <input onchange="atualizarCamposPDA('${idOrcamento}', '${campo}', this)" style="background-color: ${data ? '#0080004a' : '#ff00004a'};" class="datas-pda" style="background-color: transparent;" type="date" value="${data}">
            </td>
        `
    }

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    const opcoesStatus = ['', ...fluxograma]
        .map(st => `<option ${orcamento?.status?.atual == st ? 'selected' : ''}>${st}</option>`)
        .join('')

    const tds = `
        <td>${data}</td>
        <td>${orcamento?.dados_orcam?.contrato || '--'}</td>
        <td>${cliente?.nome || '--'}</td>
        <td>
            <select class="opcoesSelect" onchange="alterar_status(this, '${idOrcamento}')">${opcoesStatus}</select>
        </td>
        <td>${responsaveis}</td>
        <td>
            <div style="${horizontal}; justify-content: left; gap: 5px;">
                <img onclick="adicionarObservacao('${idOrcamento}')" src="imagens/editar.png" style="width: 1.5rem;">
                <span style="min-width: 100px; text-align: left;">${orcamento?.observacao || ''}</span>
            </div>
        </td>

        <td style="white-space: nowrap;">${dinheiro(orcamento?.total_geral)}</td>

        ${datas('dtSaida')}
        ${datas('previsao')}
        ${datas('dtEntrega')}

        <td>
            <select onchange="atualizarCamposPDA('${idOrcamento}', 'transportadora', this)">${transportadoras}</select>
        </td>
        <td style="text-align: center;" onclick="abrirAtalhos('${idOrcamento}')">
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;">
        </td>
    `

    const trExistente = document.getElementById(idOrcamento)

    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('linhas').insertAdjacentHTML('beforeend', `<tr id="${idOrcamento}">${tds}</tr>`)

}

async function atualizarCamposPDA(idOrcamento, campo, input) {

    let orcamento = dados_orcamentos[idOrcamento]

    orcamento[campo] = input.value

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${idOrcamento}/${campo}`, input.value)

    criarLinhaPDA(idOrcamento, orcamento)

}

async function adicionarObservacao(idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]
    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
            <span>Escreva uma observação:</span>
            <textarea name="observacao" cols="50" rows="10">${orcamento?.observacao || ''}</textarea>
            <button onclick="salvarObservacao('${idOrcamento}')">Salvar Observação</button>
        </div>
    `

    popup(acumulado, 'Observação', true)

}

async function salvarObservacao(idOrcamento) {

    const observacao = document.querySelector('[name="observacao"]').value
    let orcamento = dados_orcamentos[idOrcamento]

    orcamento.observacao = observacao

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${idOrcamento}/observacao`, observacao)

    criarLinhaPDA(idOrcamento, orcamento)

    removerPopup()

}