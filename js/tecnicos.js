async function telaMovimentos() {


    tela.innerHTML = `
        <div class="pagina-relatorio">
            <div class="painel-tecnicos">
                <div id="tecnicosResumido"></div>
                <div id="tecnicosDetalhado"></div>
            </div>
        </div>
    `

    await criarTabelaTecResumida()
    await criarTabelaTecDetalhada()

}

async function criarTabelaTecResumida(tecnico = null) {

    const pag = 'tecnicosResumido'
    const tabelaResumida = await modTab({
        pag,
        ...(
            tecnico
                ? {
                    filtros: {
                        tecnico: { op: '=', value: tecnico }
                    }
                }
                : {}
        ),
        base: 'vw_saldo_estoque_tecnicos',
        btnExtras: `
            <div style="${horizontal}; gap: 1rem;">
                <span style="font-size: 1.1rem; color: white;">SALDO DE PEÇAS POR TÉCNICO</span>
                <img src="imagens/baixar.png" onclick="criarMovimento()">
            </div>
        `,
        body: 'bodyTecResumido',
        criarLinha: 'criarLinhaTecsResumido',
        colunas: {
            'Técnico': { chave: 'tecnico' },
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao_peca' },
            'Sinal': {},
            'Saldo': {}
        }
    })

    const local = document.getElementById('tecnicosResumido')

    if (local)
        local.innerHTML = tabelaResumida

    await paginacao(pag)

}

async function criarTabelaTecDetalhada() {

    const pag = 'estoque_tecnicos'
    const tabela = await modTab({
        pag,
        base: 'vw_movimentacao_estoque',
        btnExtras: '<span style="font-size: 1.1rem; color: white;">DETALHAMENTO DE MOVIMENTO DE PEÇAS</span>',
        colunas: {
            'Edição': {},
            'Data': { chave: 'data', tipoPesquisa: 'data' },
            'Usuário': { chave: 'usuario' },
            'Técnicos': { chave: 'tecnico' },
            'Ocorrência': { chave: 'id_ocorrencia' },
            'Sinal': {},
            'Operação': { chave: 'operacao' },
            'Quantidade': { chave: 'quantidade' },
            'Origem': { chave: 'origem' },
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' }
        },
        explode: {
            path: 'equipamentos'
        },
        body: 'bodyTecnicos',
        criarLinha: 'criarLinhaMovimento'
    })

    const local = document.getElementById('tecnicosDetalhado')
    if (local)
        local.innerHTML = tabela

    await paginacao(pag)

}

async function criarLinhaTecsResumido(tec) {

    const { tecnico, codigo, descricao_peca, saldo_atual } = tec || {}

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
            <td style="text-align: center;">
                <img src="imagens/${img}.png">
            </td>
            <td style="text-align: center;">${saldo_atual}</td>
        </tr>
    `

}

async function criarMovimento(id = crypto.randomUUID()) {

    overlayAguarde()

    const { tecnico, equipamentos } = await recuperarDado('estoque_tecnicos', id) || {}

    const listagemEquipamentos = (
        await Promise.all(
            Object.values(equipamentos || {})
                .map(equip => maisLabel(equip))
        )
    ).join('')

    controlesCxOpcoes.tecnico = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const linhas = [
        {
            texto: 'Selecione o técnico',
            elemento: `<span ${tecnico ? `id="${tecnico}"` : ''} class="campos" name="tecnico" onclick="cxOpcoes('tecnico')">${tecnico || 'Selecionar'}</span>`
        },
        {
            texto: 'Qual a operação?',
            elemento: `<select id="operacao">${['Recebimento', 'Saída'].map(o => `<option>${o}</option>`).join('')}</select>`
        },
        {
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" onclick="maisLabel({formulario: 'tecnico'})">
                    <span>Adicione equipamentos</span>
                    <button onclick="adicionarKitPadrao()">Adicionar Kit Padrão</button>
                </div>

                <div style="${vertical}; width: 100%; gap: 2px;" id="equipamentos">
                    ${listagemEquipamentos}
                </div>

            </div>
            `
        },
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarMovimento('${id}')` }
    ]

    if (tecnico)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirMovimento('${id}')` })

    popup({ linhas, botoes, titulo: 'Adicionar Saldo' })

}

async function adicionarKitPadrao() {

    overlayAguarde()

    const { equipamentos } = await recuperarDado('kit_padrao', '1') || {}

    const listagemEquipamentos = (
        await Promise.all(
            Object.values(equipamentos || {})
                .map(equip => maisLabel(equip))
        )
    ).join('')

    const local = document.getElementById('equipamentos')

    if(local)
        local.innerHTML = listagemEquipamentos

    removerOverlay()

}

async function formularioKitTecnicoPadrao() {

    const { equipamentos } = await recuperarDado('kit_padrao', '1') || {}

    const listagemEquipamentos = (
        await Promise.all(
            Object.values(equipamentos || {})
                .map(equip => maisLabel(equip))
        )
    ).join('')

    const linhas = [
        {
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" onclick="maisLabel({formulario: 'tecnico'})">
                    <span>Adicione equipamentos</span>
                </div>

                <div style="${vertical}; width: 100%; gap: 2px;" id="equipamentos">
                    ${listagemEquipamentos}
                </div>

            </div>
            `
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarKitTecPadrao()` }
    ]

    popup({ linhas, botoes, titulo: 'Kit Técnico Padrão' })

}

async function salvarKitTecPadrao() {

    overlayAguarde()

    const equipamentos = {}
    const divs = [...document.querySelectorAll('[name="equipamentos"]')]
    const emMassa = divs
        .filter(div => div.querySelector('span')?.id)
        .map(async (div) => {

            const equip = div.querySelector('span')
            const { unidade, modelo, descricao, fabricante } = await recuperarDado('dados_composicoes', equip.id)

            const inputQuantidade = div.querySelector('#quantidade')
            const quantidade = Number(inputQuantidade.value)
            const serie = [...div.querySelectorAll('[name="serie"]')]
                .map(input => input.value)

            const codigo = equip.id

            equipamentos[codigo] = {
                codigo,
                modelo,
                serie,
                descricao,
                fabricante,
                quantidade,
                unidade
            }

        })

    await Promise.all(emMassa)

    const novo = {
        equipamentos,
        usuario: acesso.usuario,
        data: new Date().toLocaleString()
    }

    await enviar(`kit_padrao/1`, novo)

    removerPopup()

}

async function salvarMovimento(id) {


    try {
        overlayAguarde()

        const { usuario } = await recuperarDado('estoque_tecnicos', id) || {}

        const obVal = (id) => {
            const elemento = document.getElementById(id)
            return elemento ? elemento : null
        }

        const tecnico = document.querySelector('[name="tecnico"]').id
        if (!tecnico)
            return popup({ mensagem: 'Selecione o técnico' })

        const movimento = {
            tecnico: [tecnico],
            usuario: usuario
                ? usuario
                : acesso.usuario,
            equipamentos,
            operacao: obVal('operacao').value,
            data: new Date().toISOString().split('T')[0]
        }

        // Equipamentos
        const divs = document.querySelectorAll('[name="equipamentos"]')

        for (const div of divs) {

            const equip = div.querySelector('span')

            if (!equip?.id)
                continue

            const { unidade, modelo, descricao, fabricante } = await recuperarDado('dados_composicoes', equip.id)

            const quantidade = Number(div.querySelector('#quantidade').value)
            const serie = [...div.querySelectorAll('[name="serie"]')]
                .map(input => input.value)

            movimento.equipamentos[equip.id] = {
                codigo: equip.id,
                modelo,
                serie,
                origem: 'Kit',
                id_ocorrencia: 'Saldo',
                descricao,
                fabricante,
                quantidade,
                unidade
            }
        }


        await enviar(`estoque_tecnicos/${id}`, movimento)
        removerPopup()

    } catch (err) {
        popup({ mensagem: 'Falha ao criar o movimento: fale com o suporte' })
    }

}

async function confirmarExcluirMovimento(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', fechar: true, funcao: `excluirMovimento('${id}')` }
    ]

    popup({ mensagem: 'Confirmar exclusão?', removerAnteriores: true, botoes })

}

async function excluirMovimento(id) {

    overlayAguarde()
    await deletar(`estoque_tecnicos/${id}`)
    removerOverlay()

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

    const sinal = operacao == 'Recebimento'
        ? 'up_estoque'
        : 'down_estoque'

    const funcao = operacao == 'Recebimento'
        ? `<img src="imagens/pesquisar2.png" onclick="criarMovimento('${id}')">`
        : ''

    return `
        <tr>
            <td>${funcao}</td>
            <td>${data ? conversorData(data) : ''}</td>
            <td>${usuario || ''}</td>
            <td>${tecnico ? tecnico.join(', ') : ''}</td>
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

                <div style="${vertical};">
                    <span style="color: white;">Início</span>
                    <input type="date" id="inicio" value="${dtCorrecao || ''}" onchange="carregarAgenda()">
                </div>

                <div style="${vertical};">
                    <span style="color: white;">Fim</span>
                    <input type="date" id="fim" onchange="carregarAgenda()">
                </div>

                <div class="agenda-dropdown"></div>

            </div>

            <div class="agenda-cards"></div>

        </div>

        <div class="agenda-box">
            <div class="agenda-box-titulo">Atendimentos Data x Loja</div>
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
        { path: 'Estado', titulo: 'Estado' },
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

    painelDrop.innerHTML = drops.join('')

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

    const { resultados, total, paginas } = await pesquisarDB({
        base: 'vw_tecnicos',
        limite: 9999999,
        filtros: {
            ...controles?.agenda?.filtros,
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
                const cor = colorFromString(item.Loja);

                return `
                    <span
                        class="agenda-badge"
                        onmouseenter="tooltipAgenda(this, '${encodeURIComponent(JSON.stringify(item))}')"
                        onmouseleave="removerTooltip()"
                        style="background:${cor.bg}; border-color:${cor.border}; color:${cor.text};">
                                ${esc(shortLoja(item.Loja))}
                    </span>`
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
    const { Loja, tecnico, dt, usuario, Cidade, Estado, origem_id } = JSON.parse(decodeURIComponent(dados))

    const rect = elemento.getBoundingClientRect()
    const topPage = rect.top + window.scrollY
    const leftPage = rect.left + window.scrollX

    const tooltip = `
        <div class="tooltip-agenda">
            <div class="tooltip-agenda-titulo">${Loja}</div>
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