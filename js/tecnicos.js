function statusAgenda(valor) {
    if (Array.isArray(valor)) return valor
    try { const lista = JSON.parse(valor); return Array.isArray(lista) ? lista : [] } catch { return [] }
}

function listaAtendimentosAgenda(valor) {
    if (Array.isArray(valor)) return valor
    try { const lista = JSON.parse(valor); return Array.isArray(lista) ? lista : [] } catch { return [] }
}

function correspondeFiltrosAgenda(item, filtros) {
    const data = valor => {
        const texto = String(valor || '').split(' ')[0]
        return texto.includes('/') ? texto.split('/').reverse().join('-') : texto.slice(0, 10)
    }
    return Object.entries(filtros).every(([chave, config]) => {
        const valores = chave === 'ultimaCorrecao.*.nome'
            ? statusAgenda(item.ultimaCorrecao).map(c => c.nome) : [item[chave]]
        const regras = Array.isArray(config) ? config : config.regras || [config]
        const resultados = regras.map(regra => {
            const comparar = valor => {
                if (regra.op === '>=d') return data(valor) >= data(regra.value)
                if (regra.op === '<=d') return data(valor) <= data(regra.value)
                if (regra.op === 'includes') return String(valor || '').toLocaleLowerCase().includes(String(regra.value || '').toLocaleLowerCase())
                return String(valor ?? '') === String(regra.value ?? '')
            }
            return regra.op === '!=' ? valores.every(v => !comparar(v)) : valores.some(comparar)
        })
        return config.modo === 'OR' ? resultados.some(Boolean) : resultados.every(Boolean)
    })
}

// AGENDA
function pegarSegunda(date = dataServidor()) {
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
            <div class="agenda-filtro" id="agenda-painel-filtros">

                <div class="campo-pesquisa">
                    <label for="inicio">Início</label>
                    <input type="date" id="inicio" value="${dtCorrecao || ''}" onchange="carregarAgenda()">
                </div>

                <div class="campo-pesquisa">
                    <label for="fim">Fim</label>
                    <input type="date" id="fim" onchange="carregarAgenda()">
                </div>

                <div class="agenda-dropdown"></div>

            </div>

            <div class="agenda-cards"></div>

        </div>

        <div class="agenda-box">
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

    const listagens = await recuperarDado('mvw_opcoes_filtros', 1) || {}
    const campos = [
        { path: 'tecnico', titulo: 'T\u00e9cnico', chave: 'executores' },
        { path: 'Estado', titulo: 'Estado', chave: 'estados' }
    ]
    const drops = campos.map(({ path, titulo, chave }) => montarDropdownCheckbox({
        titulo,
        pag,
        funcao: 'carregarAgenda',
        path,
        opcoes: listagens[chave] || []
    }))

    drops.push(`
        <div class="campo-pesquisa">
            <span>Loja</span>
                <input onkeydown="if (event.key === 'Enter') pesquisarCampoLivreAgenda('Loja', this.value)" 
                    onchange="pesquisarCampoLivreAgenda('Loja', this.value)"
                    placeholder="Loja" 
                    style="width: 100%;">
        </div>

        <label class="agenda-solucionados">
            <input onchange="carregarAgenda()" id="checkbox_solucionados" type="checkbox">
            <span>Mostrar solucionados</span>
        </label>

        `)

    painelDrop.innerHTML = drops.join('')

}

async function pesquisarCampoLivreAgenda(chave, value) {

    controles.agenda.filtros ??= {}
    controles.agenda.filtros = {
        ...controles.agenda.filtros,
        [chave]: { op: 'includes', value: value.trim() }
    }
    if (!value.trim()) delete controles.agenda.filtros[chave]

    await carregarAgenda()

}

async function carregarAgenda(filtros, pagina = 1) {

    controles.agenda ??= {}
    controles.agenda.filtros ??= {}

    const local = document.querySelector('.agenda-table-wrap')
    const baloes = document.querySelector('.agenda-cards')
    const inicio = document.getElementById('inicio')?.value
    const fim = document.getElementById('fim')?.value
    const loading = '<div class="agenda-loading" role="status" aria-label="Carregando agenda"><img src="gifs/loading.gif" alt="" style="width: 5rem;"></div>'

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

    const filtrosItens = {
        ...controles.agenda.filtros,
        ...(!checkSolucionados ? { 'ultimaCorrecao.*.nome': { op: '!=', value: 'SOLUCIONADA' } } : {}),
        dtCorrecao: filtro
    }
    // O status é verificado por atendimento. Aplicar != no array agrupado
    // pode excluir o técnico inteiro por ter um atendimento solucionado.
    const filtrosConsulta = Object.fromEntries(Object.entries(filtrosItens)
        .filter(([chave]) => !['ultimaCorrecao.*.nome', 'Loja'].includes(chave)).map(([chave, regra]) =>
        [chave === 'tecnico' ? chave : 'atendimentos.*.' + chave, regra]))
    let resposta
    try {
        resposta = await pesquisarDB({
        base: 'vw_agenda_tecnicos',
        limite: 9999,
        pagina,
        ordenar: { path: 'tecnico', direcao: 'ASC' },
        filtros: filtrosConsulta
        })
    } catch (erro) {
        console.error('Erro ao carregar agenda:', erro)
        baloes.innerHTML = ''
        const aviso = document.createElement('div')
        aviso.className = 'agenda-vazia'
        aviso.textContent = `Não foi possível carregar a agenda: ${erro.message || erro}`
        local.replaceChildren(aviso)
        return
    }
    const { resultados } = resposta || {}
    const linhas = (resultados || []).flatMap(grupo => listaAtendimentosAgenda(grupo.atendimentos)
        .map(item => ({ ...item, ultimaCorrecao: statusAgenda(item.ultimaCorrecao) }))
        .filter(item => correspondeFiltrosAgenda(item, filtrosItens)))

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


// TÉCNICOS LIVRES HOJE (letreiro da toolbar)
// Efetivos (técnico com documento no RH) que não aparecem em nenhuma correção cobrindo hoje,
// seja qual for o status do chamado. O cálculo é da vw_tecnicos_livres_hoje.

const PERMISSOES_SEM_TECNICOS_LIVRES = ['técnico', 'cliente']
// Atualiza na hora quando uma ocorrência é salva (websocket.js) e à meia-noite;
// o intervalo é só reserva, para o caso de o websocket cair.
const INTERVALO_TECNICOS_LIVRES = 10 * 60 * 1000
let temporizadorTecnicosLivres = null
let temporizadorMeiaNoiteTecnicos = null
let ultimosTecnicosLivres = null

function hojeTecnicosLivres() {
    const hoje = dataServidor()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

// Uma consulta só: a vw_tecnicos_livres_hoje (gcs/SQL/tecnicos_livres_hoje.sql) já cruza, no
// banco, os efetivos com as correções que cobrem hoje. O "hoje" também vem do banco.
async function buscarTecnicosLivres() {
    const { resultados } = await pesquisarDB({ base: 'vw_tecnicos_livres_hoje', limite: 5000 }) || {}
    const livres = (resultados || [])
        .sort((a, b) => String(a.nome || a.usuario).localeCompare(String(b.nome || b.usuario), 'pt-BR'))
    return { livres, hoje: livres[0]?.dia || hojeTecnicosLivres() }
}

function renderTecnicosLivres(livres, hoje) {

    const area = document.querySelector('.tecnicos-livres')
    if (!area) return

    ultimosTecnicosLivres = { livres, hoje }

    const [, mes, dia] = hoje.split('-')
    // No letreiro só a cidade; o estado fica na lista do popup.
    const nomes = livres.map(({ nome, usuario, cidade }) =>
        `<span class="tecnicos-livres-nome">${escaparAtributo(nome || usuario)}${cidade ? ` <small>${escaparAtributo(cidade)}</small>` : ''}</span>`)

    const conteudo = nomes.length
        ? nomes.join('<span class="tecnicos-livres-separador" aria-hidden="true">•</span>')
        : '<span class="tecnicos-livres-nome">Nenhum técnico livre</span>'

    // O conteúdo vai duplicado para o loop emendar sem salto (a faixa anda metade da largura).
    area.innerHTML = `
        <span class="tecnicos-livres-data" title="Técnicos efetivos sem correção agendada hoje">Livres hoje · ${dia}/${mes}</span>
        <div class="tecnicos-livres-janela" aria-label="${livres.length} técnicos livres hoje">
            <div class="tecnicos-livres-faixa" style="--duracao-letreiro: ${Math.max(20, livres.length * 4)}s">
                <div class="tecnicos-livres-grupo">${conteudo}</div>
                <div class="tecnicos-livres-grupo" aria-hidden="true">${conteudo}</div>
            </div>
        </div>`

    // Clique (ou Enter/espaço) abre a lista completa.
    area.setAttribute('role', 'button')
    area.tabIndex = 0
    area.title = 'Ver lista de técnicos livres hoje'
    area.onclick = abrirTecnicosLivres
    area.onkeydown = evento => {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault()
            abrirTecnicosLivres()
        }
    }

    area.hidden = false
}

// Ao salvar uma correção, tira do letreiro na hora os técnicos que ela ocupa hoje, com os
// dados do próprio formulário; a consulta ao servidor vem em seguida e confirma.
function retirarDosLivresAgora(tecnicos, inicio, fim) {
    if (!ultimosTecnicosLivres || !tecnicos?.length || !inicio) return
    const { livres, hoje } = ultimosTecnicosLivres
    // Datas do formulário em AAAA-MM-DD: comparação de texto basta. Sem data final, vale só o início.
    if (inicio > hoje || (fim || inicio) < hoje) return
    const ocupados = new Set(tecnicos.map(t => String(t).trim()))
    const restantes = livres.filter(t => !ocupados.has(String(t.usuario).trim()))
    if (restantes.length === livres.length) return
    geracaoTecnicosLivres++ // invalida uma consulta que ainda esteja em andamento
    renderTecnicosLivres(restantes, hoje)
}

async function abrirTecnicosLivres() {

    // Consulta de novo ao abrir: a lista do popup é a de agora, não a da última atualização.
    overlayAguarde()
    await atualizarTecnicosLivres()
    removerOverlay()

    if (!ultimosTecnicosLivres)
        return popup({ mensagem: 'Não foi possível consultar os técnicos livres agora.' })

    const { livres, hoje } = ultimosTecnicosLivres
    const [ano, mes, dia] = hoje.split('-')

    const linhas = livres
        .map(({ nome, usuario, cidade, estado }) => `
            <tr>
                <td>${escaparAtributo(nome || '')}</td>
                <td>${escaparAtributo(usuario || '')}</td>
                <td>${escaparAtributo(cidade || '')}</td>
                <td>${escaparAtributo(estado || '')}</td>
            </tr>`)
        .join('')

    const elemento = `
        <div class="tecnicos-livres-lista">
            <div class="tecnicos-livres-aviso" role="note">
                <img src="imagens/alerta.png" alt="">
                <span>Para o técnico aparecer aqui é necessário ter algum documento cadastrado no RH.</span>
            </div>
            <p>${livres.length} ${livres.length === 1 ? 'técnico efetivo' : 'técnicos efetivos'} sem correção agendada em ${dia}/${mes}/${ano}.</p>
            ${livres.length
                ? `<table class="relatorio-cc-tab">
                        <thead><tr><th>Nome</th><th>Usuário</th><th>Cidade</th><th>Estado</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>`
                : ''}
        </div>`

    popup({ elemento, titulo: 'Técnicos livres hoje' })
}

function podeVerTecnicosLivres() {
    const { permissao, token } = JSON.parse(localStorage.getItem('acesso')) || {}
    return Boolean(token) && !PERMISSOES_SEM_TECNICOS_LIVRES.includes(permissao)
}

// Esconde e apaga: o logout não recarrega a página, e a lista não pode passar para o próximo usuário.
function ocultarTecnicosLivres() {
    const area = document.querySelector('.tecnicos-livres')
    ultimosTecnicosLivres = null
    if (!area) return
    area.hidden = true
    area.innerHTML = ''
    area.onclick = null
    area.onkeydown = null
    area.removeAttribute('role')
    area.removeAttribute('tabindex')
}

// Várias origens disparam a atualização (salvar, websocket, meia-noite, reserva); se duas
// rodarem juntas, só a mais recente desenha, para uma resposta antiga não voltar a lista.
let geracaoTecnicosLivres = 0

async function atualizarTecnicosLivres() {

    if (!document.querySelector('.tecnicos-livres') || !podeVerTecnicosLivres())
        return ocultarTecnicosLivres()

    const geracao = ++geracaoTecnicosLivres

    try {
        const { livres, hoje } = await buscarTecnicosLivres()
        if (geracao !== geracaoTecnicosLivres) return
        // O usuário pode ter trocado durante a consulta.
        if (!podeVerTecnicosLivres())
            return ocultarTecnicosLivres()
        renderTecnicosLivres(livres, hoje)
    } catch (erro) {
        if (geracao !== geracaoTecnicosLivres) return
        // Sem conseguir saber quem está ocupado, é melhor não mostrar do que mostrar errado.
        console.error('Técnicos livres:', erro)
        ocultarTecnicosLivres()
    }
}

// Agenda a troca de dia pelo relógio do servidor (5 s depois da meia-noite).
function agendarMeiaNoiteTecnicosLivres() {
    clearTimeout(temporizadorMeiaNoiteTecnicos)
    const agora = dataServidor()
    const virada = new Date(agora)
    virada.setHours(24, 0, 5, 0)
    temporizadorMeiaNoiteTecnicos = setTimeout(() => {
        atualizarTecnicosLivres()
        agendarMeiaNoiteTecnicosLivres()
    }, virada - agora)
}

function iniciarTecnicosLivres() {
    atualizarTecnicosLivres()
    if (!temporizadorTecnicosLivres)
        temporizadorTecnicosLivres = setInterval(atualizarTecnicosLivres, INTERVALO_TECNICOS_LIVRES)
    agendarMeiaNoiteTecnicosLivres()
}
