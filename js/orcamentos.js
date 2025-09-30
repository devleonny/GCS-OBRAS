let filtrosOrcamento = {}
let dados_clientes = {}
let intervaloCompleto
let intervaloCurto
let filtro;
let naoArquivados = true
let meusOrcamentos = true
let auxiliarFaturamento = {}
let baloes = document.querySelector('.baloes-top')

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

    let tempFluxograma = { 'TODOS': {}, ...fluxograma };
    for (const st in tempFluxograma) {
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

    if (!semOverlay) overlayAguarde()
    verificarFluxograma()

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
        <div style="${vertical}; width: 95vw;">
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

    const tabelaExistente = document.querySelector('.div-tabela')
    if (!tabelaExistente) tela.innerHTML = acumulado

    const dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_clientes = await recuperarDados('dados_clientes') || {}

    let idsAtivos = []
    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos).reverse()) {
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

    filtrarOrcamentos({ ultimoStatus: 'TODOS' })

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

    let label_pedidos = ''
    let label_notas = ''

    if (orcamento.status && orcamento.status.historico) {

        for ([chave, historico] of Object.entries(orcamento.status.historico)) {

            if (historico.status == 'PEDIDO') {

                let num_pedido = historico.pedido
                let tipo = historico.tipo
                let valor_pedido = conversor(historico.valor)

                label_pedidos += `
                        <div class="etiqueta_pedidos"> 
                            <label>${tipo}</label>
                            <label><b>${num_pedido}</b></label>
                            <label><b>${dinheiro(valor_pedido)}</b></label>
                        </div>
                        `
            }

            if (historico.status == 'FATURADO') {

                if (historico.parcelas && historico.parcelas.length > 0) {

                    if (!auxiliarFaturamento[idOrcamento]) {
                        auxiliarFaturamento[idOrcamento] = []
                    }

                    auxiliarFaturamento[idOrcamento].push(historico)
                }

                label_notas += `
                    <div class="etiqueta_pedidos">
                        <label>${historico.tipo}</label>
                        <label><b>${historico.nf}</b></label>
                        <label><b>${dinheiro(historico.valor)}</b></label>
                    </div>
                    `
            }
        }

    }

    let st = orcamento?.status?.atual || ''

    let opcoes = '<option></option>'
    for (fluxo in fluxograma) {
        opcoes += `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`
    }

    let {
        impostos = 0,
        custo_compra = 0,
        frete_venda = 0,
        pagamentos = 0
    } = orcamento?.dados_custos || {}

    let lucratividade = orcamento.total_geral - impostos - custo_compra - frete_venda - pagamentos
    let lucratividadePorcentagem = Number(((lucratividade / orcamento.total_geral) * 100).toFixed(0))

    const autorizados = Object.entries(orcamento?.usuarios || {})
        .map(([usuario, dados]) => usuario)
        .join('<br>')

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
        <td>${label_pedidos}</td>
        <td>${label_notas}</td>
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
        <td>${autorizados}</td>
        <td><input style="display: none;" value="${lucratividadePorcentagem}">${divPorcentagem(lucratividadePorcentagem)}</td>
        <td>${orcamento?.checklist?.andamento ? divPorcentagem(orcamento.checklist.andamento) : ''}</td>
        <td style="white-space: nowrap;">${dinheiro(orcamento.total_geral)}</td>
        <td style="text-align: center;" onclick="abrirAtalhos('${idOrcamento}')">
            <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;">
        </td>`

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

async function verificarParcelas() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let valores = {}

    for (let [idOrcamento, notas] of Object.entries(auxiliarFaturamento)) {
        let orcamento = dados_orcamentos[idOrcamento]
        let nomeCliente = dados_clientes?.[orcamento.dados_orcam.omie_cliente]?.nome || '??'

        notas.forEach(nota => {

            nota.parcelas.forEach(parcela => {

                let [dia, mes, ano] = parcela.dDtVenc.split('/')

                if (!valores[ano]) {
                    valores[ano] = { total: 0, meses: {} }
                }

                if (!valores[ano].meses[mes]) {
                    valores[ano].meses[mes] = { parcelas: [], total: 0 }
                }

                valores[ano].total += parcela.nValorTitulo
                valores[ano].meses[mes].total += parcela.nValorTitulo

                valores[ano].meses[mes].parcelas.push({
                    orcamento: nomeCliente,
                    parcela: parcela.nParcela,
                    vencimento: parcela.dDtVenc,
                    valor: parcela.nValorTitulo,
                    idOrcamento
                })

            })
        })
    }

    let elementos = ''
    for ([ano, objeto] of Object.entries(valores)) {

        elementos += `
        <label style="font-size: 1.5vw;">[<strong>${ano}</strong>] ${dinheiro(objeto.total)}</label>
        <hr style="width: 100%;">
        `
        let linhas = ''
        for (mes in objeto.meses) {

            let divParcelas = ''
            objeto.meses[mes].parcelas.forEach(fragPacela => {

                divParcelas += `
                <div class="parcela">
                    <label><strong>Vencimento</strong> ${fragPacela.vencimento}</label>
                    <label><strong>Parcela ${fragPacela.parcela}</strong> ${dinheiro(fragPacela.valor)}</label>
                    <div style="display: flex; justify-content: start; align-items: center; gap: 5px;">
                        <img src="imagens/projeto.png" style="cursor: pointer; width: 2vw;" onclick="abrirEsquema('${fragPacela.idOrcamento}')">
                        <label>${fragPacela.orcamento}</label>
                    </div>
                </div>
                `
            })
            linhas += `
            <div style="display: flex; justify-content: center; align-items: center; gap: 5px;" onclick="mostrarParcelas(this)">
                <img src="imagens/pasta.png" style="width: 2vw; cursor: pointer;">
                <label><strong>${meses[mes]}</strong> ${dinheiro(objeto.meses[mes].total)}</label>
            </div>

            <div style="display: none; flex-direction: column; align-items: start; justify-content: start; gap: 2px;">
                ${divParcelas}
            </div>
            `
        }

        elementos += linhas

    }

    let acumulado = `
        <div style="display: flex; justify-content: start; align-items: start; flex-direction: column; background-color: #d2d2d2; padding: 5px; width: 40vw;">
            ${elementos}
        </div>
    `
    popup(acumulado, 'Faturamento Parcelas')

}

function mostrarParcelas(divSuperior) {

    let divSeguinte = divSuperior.nextElementSibling
    let visibilidade = divSeguinte.style.display

    divSeguinte.style.display = visibilidade == 'none' ? 'flex' : 'none'

}

async function editar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    if (orcamentoBase.aprovacao) delete orcamentoBase.aprovacao

    await baseOrcamento(orcamentoBase)

    removerPopup()

    orcamentoBase.lpu_ativa == 'ALUGUEL'
        ? await criarOrcamentoAluguel()
        : await criarOrcamento()

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
        ? await criarOrcamentoAluguel()
        : await criarOrcamento()

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