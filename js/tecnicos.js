async function telaSaldoFerramentas(tecnico = null) {

    const titulo = tecnico
        ? `SALDO DE FERRAMENTAS ${tecnico}`
        : 'SALDO DE FERRAMENTAS POR TÉCNICO'

    const filtros = tecnico
        ? {
            tecnico: { op: 'includes', value: tecnico }
        }
        : {}

    const pag = 'tecnicosResumido'
    const tabelaResumida = await modTab({
        pag,
        filtros: {
            ...filtros,
            origem: { op: '=', value: 'Ferramentas' }
        },
        base: 'vw_tecnicos_saldo',
        btnExtras: `<span style="font-size: 1.1rem; color: white;">${titulo}</span>`,
        body: 'bodyTecResumido',
        criarLinha: 'criarLinhaTecsResumido',
        colunas: {
            'Técnico': {
                ...(tecnico
                    ? {}
                    : { chave: 'tecnico' })
            },
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao_peca' },
            'Unidade': { chave: 'unidade' },
            'Modelo': { chave: 'modelo' },
            'Fabricante': { chave: 'fabricante' },
            'Sinal': {},
            'Saldo': {}
        }
    })

    const elemento = `<div class="painel-saldos">${tabelaResumida}</div>`

    const painel_resumo = document.getElementById('painel_resumo')

    if (painel_resumo)
        painel_resumo.innerHTML = tabelaResumida
    else
        tela.innerHTML = elemento

    await paginacao(pag)

}

async function telaSaldoPecas(tecnico = null) {

    const titulo = tecnico
        ? `SALDO DE PEÇAS ${tecnico}`
        : 'SALDO DE PEÇAS POR TÉCNICO'

    const filtros = tecnico
        ? {
            tecnico: { op: 'includes', value: tecnico }
        }
        : {}

    const pag = 'tecnicosResumido'
    const tabelaResumida = await modTab({
        pag,
        filtros: {
            ...filtros,
            origem: { op: '=', value: 'Kit' }
        },
        base: 'vw_tecnicos_saldo',
        btnExtras: `<span style="font-size: 1.1rem; color: white;">${titulo}</span>`,
        body: 'bodyTecResumido',
        criarLinha: 'criarLinhaTecsResumido',
        colunas: {
            'Técnico': {
                ...(tecnico
                    ? {}
                    : { chave: 'tecnico' })
            },
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao_peca' },
            'Unidade': { chave: 'unidade' },
            'Modelo': { chave: 'modelo' },
            'Fabricante': { chave: 'fabricante' },
            'Sinal': {},
            'Saldo': {}
        }
    })

    const elemento = `<div class="painel-saldos">${tabelaResumida}</div>`

    const painel_resumo = document.getElementById('painel_resumo')

    if (painel_resumo)
        painel_resumo.innerHTML = tabelaResumida
    else
        tela.innerHTML = elemento

    await paginacao(pag)

}

async function criarTabelaTecDetalhada(tecnico = null) {

    const filtros = tecnico
        ? { tecnico: { op: 'includes', value: tecnico } }
        : {}

    const titulo = tecnico
        ? `Detalhamento ${tecnico}`
        : 'TODOS OS MOVIMENTOS'

    const pag = 'estoque_tecnicos'
    const tabelaResumida = await modTab({
        pag,
        filtros,
        base: 'vw_tecnicos_movimentos',
        btnExtras: `<span style="font-size: 1.1rem; color: white;">${titulo}</span>`,
        colunas: {
            'Data': { chave: 'data', tipoPesquisa: 'data' },
            'Solicitante': { chave: 'usuario' },
            'Técnicos': tecnico
                ? {}
                : { chave: 'tecnico' },
            'Contrato': { chave: 'id_ocorrencia' },
            'Sinal': {},
            'Operação': { chave: 'operacao' },
            'Quantidade': { chave: 'quantidade' },
            'Origem': { chave: 'origem' },
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'equipamentos.*.descricao' }
        },
        explode: {
            path: 'equipamentos'
        },
        body: 'bodyTecnicos',
        criarLinha: 'criarLinhaMovimento'
    })

    const elemento = `<div class="painel-saldos">${tabelaResumida}</div>`

    const painel_resumo = document.getElementById('painel_resumo')

    if (painel_resumo)
        painel_resumo.innerHTML = tabelaResumida
    else
        tela.innerHTML = elemento

    await paginacao(pag)

}

async function criarLinhaTecsResumido(tec) {

    const {
        tecnico,
        codigo,
        fabricante,
        modelo,
        unidade,
        descricao_peca,
        saldo_atual
    } = tec || {}

    const img = saldo_atual == 0
        ? 'congelado'
        : saldo_atual > 0
            ? 'aprovado'
            : 'reprovado'

    return `
        <tr>
            <td>${tecnico}</td>
            <td>${codigo}</td>
            <td>${descricao_peca}</td>
            <td>${unidade || ''}</td>
            <td>${modelo || ''}</td>
            <td>${fabricante || ''}</td>
            <td style="text-align: center;">
                <img src="imagens/${img}.png">
            </td>
            <td style="text-align: center;">${saldo_atual}</td>
        </tr>
    `

}

async function criarLinhaMovimento(movimento) {

    const {
        id,
        usuario,
        tecnico,
        id_ocorrencia,
        operacao,
        data,
        codigo,
        comentario,
        descricao,
        quantidade,
        origem
    } = movimento || {}

    const sinal = operacao == 'Entrada'
        ? 'up_estoque'
        : 'down_estoque'

    return `
        <tr>
            <td>${data ? conversorData(data) : ''}</td>
            <td>${usuario || ''}</td>
            <td style="white-space: pre;">${tecnico ? tecnico.map(t => `• ${t}`).join('\n') : ''}</td>
            <td>${id_ocorrencia || ''}</td>
            <td style="text-align: center;">
                <img src="imagens/${sinal}.png">
            </td>
            <td>${operacao || ''}</td>
            <td>${quantidade || ''}</td>
            <td>${origem || ''}</td>
            <td>${codigo || ''}</td>
            <td>${descricao || ''}</td>
        </tr>
    `

}


async function abrirResumo(tecnico) {

    const elemento = `
        <div class="painel-saldos-flutuante">
            <div style="${horizontal}; gap: 5px;">
                <button onclick="telaSaldoPecas('${tecnico}')">Saldo Peças</button>
                <button onclick="telaSaldoFerramentas('${tecnico}')">Saldo Ferramentas</button>
                <button onclick="criarTabelaTecDetalhada('${tecnico}')">Histórico de Movimentos</button>
            </div>
            <div id="painel_resumo"></div>
        </div>
    `

    popup({ elemento, titulo: `Saldos de ${tecnico}` })

    await telaSaldoPecas(tecnico)

}

// AGENDA
function pegarSegunda(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d.toLocaleDateString()
}

async function telaAgenda({ flutuante = false, filtros = null } = {}) {

    const { dtCorrecao } = filtros || {}

    const agenda = `

        <div class="agenda-topo">
            <div class="agenda-filtro">

                <img src="imagens/BG.png" style="width: 12rem; filter: drop-shadow(2px 2px 2px black);">

                <div class="campo-pesquisa">
                    <span style="color: white;">Início</span>
                    <input type="date" id="inicio" value="${dtCorrecao || ''}" onchange="carregarAgenda()">
                </div>

                <div class="campo-pesquisa">
                    <span style="color: white;">Fim</span>
                    <input type="date" id="fim" onchange="carregarAgenda()">
                </div>

                <div class="agenda-dropdown"></div>

            </div>

            <div class="agenda-cards"></div>

        </div>

        <div class="agenda-box">
            <div class="agenda-box-titulo">Atendimentos Técnico x Data x Loja</div>
            <div class="agenda-table-wrap"></div>
        </div>
    `

    const elemento = `
        <div class="agenda-wrap">
            ${agenda}
        </div>
    `

    if (flutuante)
        popup({ titulo: 'Agenda', elemento: `<div class="agenda-flutuante">${agenda}</div>` })
    else
        tela.innerHTML = elemento

    await carregarAgenda(filtros)
    await criarPesquisasAgenda()

}

async function criarPesquisasAgenda() {

    const painelDrop = document.querySelector('.agenda-dropdown')
    const pag = 'agenda'
    controles[pag] ??= {}
    controles[pag].filtros ??= {}

    const campos = [
        { path: 'tecnico', titulo: 'Técnico' },
        { path: 'Estado', titulo: 'Estado' }
    ]

    const drops = []

    const emMassa = campos.map(async ({ path, titulo }) => {

        const contagem = await contarPorCampo({ base: 'vw_tecnicos', path })

        const drop = montarDropdownCheckbox({
            titulo,
            pag,
            funcao: 'carregarAgenda',
            path,
            opcoes: Object.keys(contagem)
        })

        drops.push(drop)
    })

    await Promise.all(emMassa)

    drops.push(`
        <div class="campo-pesquisa">
            <span style="color: white;">Loja</span>
            <div class="pesquisa">
                <input onkeydown="if (event.key === 'Enter') pesquisarCampoLivreAgenda('Loja', this.value)" 
                    placeholder="Loja" 
                    style="width: 100%;">
                <img src="imagens/pesquisar4.png">
            </div>
        </div>

        <div style="${horizontal}; gap: 5px;">
            <input onchange="carregarAgenda()" id="checkbox_solucionados" type="checkbox" style="width: 2rem; height: 2rem;">
            <span style="color: white;">Mostrar SOLUCIONADOS</span>
        </div>

        `)

    painelDrop.innerHTML = drops.join('')

}

async function pesquisarCampoLivreAgenda(chave, value) {

    controles.agenda.filtros ??= {}
    controles.agenda.filtros = {
        ...controles.agenda.filtros,
        [chave]: { op: 'includes', value }
    }

    await carregarAgenda()

}

async function carregarAgenda(filtros) {

    const local = document.querySelector('.agenda-table-wrap')
    const baloes = document.querySelector('.agenda-cards')
    const paginacao = document.querySelector('.agenda-paginacao')
    const inicio = document.getElementById('inicio')?.value
    const fim = document.getElementById('fim')?.value
    const loading = '<img src="gifs/loading.gif" style="width: 5rem;">'

    local.innerHTML = loading;
    baloes.innerHTML = loading;

    const inicioFinal = inicio || (!fim ? pegarSegunda() : '')

    const filtro = [
        inicioFinal && { op: '>=d', value: inicioFinal },
        fim && { op: '<=d', value: fim }
    ].filter(Boolean)

    // Existentes & dropdown;
    if (filtros) {

        const { estado = null, tecnico = null, dtCorrecao = null } = filtros || {}

        controles.agenda ??= {}
        controles.agenda.filtros ??= {}

        if (tecnico)
            controles.agenda.filtros.tecnico = {
                modo: "OR",
                origem: "dropdown",
                regras: [
                    {
                        op: "=",
                        value: tecnico
                    }
                ]
            }
        else
            delete controles.agenda.filtros.tecnico

        if (dtCorrecao)
            controles.agenda.filtros.dtCorrecao = { op: '>=d', value: dtCorrecao }
        else
            delete controles.agenda.filtros.dtCorrecao

        if (estado)
            controles.agenda.filtros.Estado = {
                modo: "OR",
                origem: "dropdown",
                regras: [
                    {
                        op: "=",
                        value: estado
                    }
                ]
            }
        else
            delete controles.agenda.filtros.Estado
    }

    // Solucionados
    const checkSolucionados = document.getElementById('checkbox_solucionados')?.checked ?? false

    const { resultados, total, paginas } = await pesquisarDB({
        base: 'vw_tecnicos',
        limite: 9999999,
        filtros: {
            ...controles?.agenda?.filtros,
            ...(
                checkSolucionados
                    ? {}
                    : { 'ultimaCorrecao.*.nome': { op: '!=', value: 'SOLUCIONADA' } }
            ),
            dtCorrecao: filtro
        }
    })

    const linhas = resultados || []

    function esc(v) {
        return String(v ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }

    function parseISODate(value) {
        if (!value || typeof value !== 'string' || !value.trim()) return null;
        const d = new Date(value + 'T00:00:00');
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function formatInputDateToBR(value) {
        if (!value) return '';
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
    }

    function shortLoja(nome) {
        const txt = String(nome || '').trim();
        return txt.length > 15 ? txt.slice(0, 15) + '…' : txt;
    }

    function colorFromString(str) {
        let hash = 0;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            hash = s.charCodeAt(i) + ((hash << 5) - hash);
            hash |= 0;
        }
        const hue = Math.abs(hash) % 360;
        return {
            bg: `hsl(${hue} 70% 88%)`,
            border: `hsl(${hue} 55% 55%)`,
            text: `hsl(${hue} 45% 22%)`
        };
    }

    function formatISODate(date) {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    function expandirPeriodo(item) {
        const inicio = parseISODate(item.dtCorrecao);
        const fimInformado = parseISODate(item.dtCorrecaoFinal);

        if (!inicio) return [];

        const fim = fimInformado && fimInformado >= inicio ? fimInformado : inicio;
        const dias = [];

        const atual = new Date(inicio);
        while (atual <= fim) {
            dias.push({
                ...item,
                dt: formatISODate(atual),
                dtObj: new Date(atual)
            });

            atual.setDate(atual.getDate() + 1);
        }

        return dias;
    }

    const dados = linhas
        .map(item => ({
            ...item,
            tecnico: String(item.tecnico || '').trim(),
            Loja: String(item.Loja || '').trim(),
            Estado: String(item.Estado || '').trim(),
            Cidade: String(item.Cidade || '').trim(),
            dtCorrecao: String(item.dtCorrecao || '').trim(),
            dtCorrecaoFinal: String(item.dtCorrecaoFinal || '').trim()
        }))
        .flatMap(expandirPeriodo)
        .filter(item => item.tecnico && item.dt && item.dtObj);

    const seen = new Set();
    const unicos = dados.filter(item => {
        const key = [
            item.origem_id,
            item.tecnico,
            item.Loja,
            item.dt
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const tecnicos = [...new Set(unicos.map(x => x.tecnico))].sort((a, b) => a.localeCompare(b));
    const dias = [...new Set(unicos.map(x => x.dt))].sort();

    const mapa = new Map();
    for (const item of unicos) {
        const key = `${item.tecnico}__${item.dt}`;
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key).push(item);
    }

    const totalRegistros = unicos.length;
    const totalTecnicos = tecnicos.length;
    const totalLojas = new Set(unicos.map(x => x.Loja)).size;
    const totalEstados = new Set(unicos.map(x => x.Estado)).size;

    const headDias = dias.map(d => {
        const [y, m, day] = d.split('-');
        return `<th class="agenda-dia" title="${esc(d)}">${esc(day)}/${esc(m)}/${y}</th>`;
    }).join('');

    const bodyRows = tecnicos.map((tecnico, rowIndex) => {
        const cells = dias.map(dt => {
            const itens = mapa.get(`${tecnico}__${dt}`) || [];
            const labels = itens.map(item => {

                const solucionada = item.ultimaCorrecao
                    .some(corr => corr.nome == 'SOLUCIONADA')

                const { Loja, origem_id } = item || {}
                const cor = colorFromString(item.Loja);
                const imgConcluido = solucionada
                    ? `<img src="imagens/concluido.png" style="width: 1.5rem;">`
                    : ''

                return `
                    <div style="${horizontal}; gap: 3px; padding: 1px;">
                         ${imgConcluido}
                        <span
                            class="agenda-badge"
                            onmouseenter="tooltipAgenda(this, '${encodeURIComponent(JSON.stringify(item))}')"
                            onmouseleave="removerTooltip()"
                            style="background:${cor.bg}; border-color:${cor.border}; color:${cor.text};">
                                    ${origem_id} - ${esc(shortLoja(Loja))}
                        </span>
                    </div>
                    `
            }).join('')

            return `<td class="agenda-celula">${labels || ''}</td>`
        }).join('')

        return `
        <tr class="agenda-row agenda-row-${rowIndex + 1}">
            <th class="agenda-tecnico" scope="row">${esc(tecnico)}</th>
            ${cells}
        </tr>
    `
    }).join('')

    const cards = [
        ['Registros válidos', totalRegistros],
        ['Técnicos', totalTecnicos],
        ['Lojas', totalLojas],
        ['Estados', totalEstados]
    ]
        .map(([titulo, valor]) => {
            return `
            <div class="agenda-card">
                <div class="agenda-card-label">${titulo}</div>
                <div class="agenda-card-valor">${valor}</div>
            </div>
        `
        })
        .join('')

    const agenda = dias.length && tecnicos.length
        ? `
            <table class="agenda-table">
                <thead>
                    <tr>
                    <th class="agenda-tecnico">Técnico</th>
                        ${headDias}
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows}
                </tbody>
            </table>
        `
        : `<div class="agenda-vazia">Nenhum registro</div>`

    baloes.innerHTML = cards
    local.innerHTML = agenda

}

function removerTooltip() {

    const tip = document.querySelector('.tooltip-agenda');
    if (tip)
        tip.remove()

}

function tooltipAgenda(elemento, dados) {

    const { Loja, tecnico, dt, usuario, Cidade, Estado, ultimaCorrecao, origem_id } = JSON.parse(decodeURIComponent(dados))

    const rect = elemento.getBoundingClientRect()
    const topPage = rect.top + window.scrollY
    const leftPage = rect.left + window.scrollX

    const nomesStatus = (ultimaCorrecao || [])
        .filter(corr => corr.nome)
        .map(corr => corr.nome)

    const labelTipoCorrecao = (nomesStatus || [])
        .map(st => formatacaoTipoCorrecao(st))
        .join('')

    const tooltip = `
        <div class="tooltip-agenda">
            <div class="tooltip-agenda-titulo">${Loja}</div>
            <div class="tooltip-agenda-linha"><b>Status:</b> ${labelTipoCorrecao}</div>
            <div class="tooltip-agenda-linha"><b>Técnico:</b> ${tecnico}</div>
            <div class="tooltip-agenda-linha"><b>Data:</b> ${conversorData(dt)}</div>
            <div class="tooltip-agenda-linha"><b>Cidade:</b> ${Cidade}</div>
            <div class="tooltip-agenda-linha"><b>Estado:</b> ${Estado}</div>
            <div class="tooltip-agenda-linha"><b>Origem:</b> ${origem_id}</div>
            <div class="tooltip-agenda-linha"><b>Agendado por:</b> ${usuario}</div>
        </div>
    `

    removerTooltip()
    document.body.insertAdjacentHTML('beforeend', tooltip)

    const tooltipEl = document.querySelector('.tooltip-agenda')
    const alturaTooltip = tooltipEl.offsetHeight
    const larguraTooltip = tooltipEl.offsetWidth

    tooltipEl.style.top = `${topPage - alturaTooltip - 8}px`
    tooltipEl.style.left = `${leftPage + (rect.width / 2) - (larguraTooltip / 2)}px`
}