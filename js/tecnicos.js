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

    // Datas não entram aqui: o período é tratado por sobreposição logo abaixo.
    const { dtCorrecao: _filtroDataAntigo, ...filtrosSemData } = controles.agenda.filtros
    const filtrosItens = {
        ...filtrosSemData,
        ...(!checkSolucionados ? { 'ultimaCorrecao.*.nome': regrasNaoTerminado() } : {})
    }
    // O status é verificado por atendimento. Aplicar != no array agrupado
    // pode excluir o técnico inteiro por ter um atendimento solucionado.
    const filtrosConsulta = Object.fromEntries(Object.entries(filtrosItens)
        .filter(([chave]) => !['ultimaCorrecao.*.nome', 'Loja'].includes(chave)).map(([chave, regra]) =>
        [chave === 'tecnico' ? chave : 'atendimentos.*.' + chave, regra]))

    // No servidor só o limite superior: uma tarefa iniciada antes do filtro ainda pode
    // ocupar dias dentro dele, então o limite inferior é conferido pelo fim da tarefa (abaixo).
    if (fim)
        filtrosConsulta['atendimentos.*.dtCorrecao'] = { op: '<=d', value: fim }
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

    // Aceita "AAAA-MM-DD..." e "DD/MM/AAAA..." (correções antigas usam o formato brasileiro).
    function dataISO(value) {
        const texto = String(value || '').trim();
        const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
        return br ? `${br[3]}-${br[2]}-${br[1]}` : '';
    }

    function parseISODate(value) {
        const iso = dataISO(value);
        if (!iso) return null;
        const d = new Date(iso + 'T00:00:00');
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

    const janelaInicio = parseISODate(inicioFinal);
    const janelaFim = parseISODate(fim);

    // Um bloco por dia do período da tarefa, só nos dias dentro do filtro.
    // Tarefa que não encosta no filtro devolve lista vazia e some da agenda.
    function expandirPeriodo(item) {
        const inicioTarefa = parseISODate(item.dtCorrecao);
        const fimInformado = parseISODate(item.dtCorrecaoFinal);

        if (!inicioTarefa) return [];

        const fimTarefa = fimInformado && fimInformado >= inicioTarefa ? fimInformado : inicioTarefa;
        const inicio = janelaInicio && janelaInicio > inicioTarefa ? janelaInicio : inicioTarefa;
        const fim = janelaFim && janelaFim < fimTarefa ? janelaFim : fimTarefa;
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
                    .some(corr => statusSolucionados.includes(corr.nome))

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
        <span class="tecnicos-livres-data" role="button" tabindex="0" title="Abrir o calendário dos técnicos"
            onclick="event.stopPropagation(); abrirCalendarioTecnicos()"
            onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); abrirCalendarioTecnicos() }"><img src="imagens/agenda.png" alt=""> Livres hoje · ${dia}/${mes}</span>
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

// Clique no letreiro: o mesmo popup do dia do calendário, com hoje (abrirDiaTecnicos).
// O letreiro é atualizado junto, para não ficar diferente do que o popup mostra.
function abrirTecnicosLivres() {
    atualizarTecnicosLivres()
    return abrirDiaTecnicos(hojeTecnicosLivres())
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

// ---------------------------------------------------------------------------
// Calendário dos técnicos (clique na data do letreiro): calendário compacto logo abaixo da data,
// sem consultar nada (abre na hora). Clicar num dia abre o popup daquele dia: livres, indisponíveis
// (Atestado, Férias... em vermelho, com cadeado) e com correção agendada.
// Dados do dia: /tecnicos/agenda (tecnicos_disponibilidade() no banco). Indisponibilidade é marcada
// e removida por /tecnicos/indisponibilidade, só para os perfis que o servidor libera (podeMarcar).
// ---------------------------------------------------------------------------

const calendarioTecnicos = { ano: 0, mes: 0 }
const NOMES_MESES_TECNICOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIAS_SEMANA_TECNICOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const isoDiaTecnicos = data =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
const brDiaTecnicos = iso => iso ? iso.split('-').reverse().join('/') : ''

async function chamarApiTecnicos(rota, corpo) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.mensagem || 'Falha ao consultar os técnicos.')
    return dados
}

function fecharCalendarioTecnicos() {
    document.querySelector('.cal-tec-flutuante')?.remove()
    document.removeEventListener('mousedown', fecharCalendarioTecnicosFora, true)
    document.removeEventListener('keydown', fecharCalendarioTecnicosEsc, true)
}

function fecharCalendarioTecnicosFora(evento) {
    if (!evento.target.closest('.cal-tec-flutuante, .tecnicos-livres-data')) fecharCalendarioTecnicos()
}

function fecharCalendarioTecnicosEsc(evento) {
    if (evento.key === 'Escape') fecharCalendarioTecnicos()
}

// Abre (ou fecha, se já aberto) logo abaixo da data do letreiro.
function abrirCalendarioTecnicos() {
    if (document.querySelector('.cal-tec-flutuante')) return fecharCalendarioTecnicos()

    const hoje = dataServidor()
    calendarioTecnicos.ano = hoje.getFullYear()
    calendarioTecnicos.mes = hoje.getMonth()

    const caixa = document.createElement('div')
    caixa.className = 'cal-tec-flutuante'
    caixa.setAttribute('role', 'dialog')
    caixa.setAttribute('aria-label', 'Calendário dos técnicos')
    document.body.appendChild(caixa)
    renderCalendarioTecnicos()

    // Posição: abaixo da data, sem passar da borda direita da tela.
    const ancora = document.querySelector('.tecnicos-livres-data')?.getBoundingClientRect()
    if (ancora) {
        caixa.style.top = `${ancora.bottom + 6}px`
        caixa.style.left = `${Math.max(8, Math.min(ancora.left, window.innerWidth - caixa.offsetWidth - 8))}px`
    }

    document.addEventListener('mousedown', fecharCalendarioTecnicosFora, true)
    document.addEventListener('keydown', fecharCalendarioTecnicosEsc, true)
}

function mudarMesTecnicos(passo) {
    const data = new Date(calendarioTecnicos.ano, calendarioTecnicos.mes + passo, 1)
    calendarioTecnicos.ano = data.getFullYear()
    calendarioTecnicos.mes = data.getMonth()
    renderCalendarioTecnicos()
}

function renderCalendarioTecnicos() {
    const caixa = document.querySelector('.cal-tec-flutuante')
    if (!caixa) return

    const { ano, mes } = calendarioTecnicos
    const hoje = dataServidor()
    const isoHoje = isoDiaTecnicos(hoje)
    const extenso = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

    // Sempre 6 semanas: dias do mês anterior e do seguinte completam a grade, esmaecidos.
    const primeiro = new Date(ano, mes, 1)
    const inicio = new Date(ano, mes, 1 - primeiro.getDay())
    const dias = Array.from({ length: 42 }, (_, i) => {
        const data = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
        const iso = isoDiaTecnicos(data)
        const classes = ['cal-tec-dia', data.getMonth() !== mes && 'fora', iso === isoHoje && 'hoje'].filter(Boolean).join(' ')
        return `<button type="button" class="${classes}" onclick="abrirDiaTecnicos('${iso}')"
            aria-label="Técnicos em ${brDiaTecnicos(iso)}">${data.getDate()}</button>`
    })

    caixa.innerHTML = `
        <div class="cal-tec-hoje">${extenso}</div>
        <div class="cal-tec-mes">
            <b>${NOMES_MESES_TECNICOS[mes]} de ${ano}</b>
            <span>
                <button type="button" onclick="mudarMesTecnicos(-1)" aria-label="Mês anterior">▲</button>
                <button type="button" onclick="mudarMesTecnicos(1)" aria-label="Próximo mês">▼</button>
            </span>
        </div>
        <div class="cal-tec-grade">
            ${DIAS_SEMANA_TECNICOS.map(d => `<span class="cal-tec-semana">${d}</span>`).join('')}
            ${dias.join('')}
        </div>`
}

// Chamados no popup do dia: passar o mouse mostra um resumo (local, descrição e última correção).
function etiquetasChamadosTecnicos(chamados = []) {
    return chamados.map(id => `<span class="cal-tec-chamado" data-chamado="${escaparAtributo(id)}"
        onmouseenter="tooltipChamadoTecnicos(this)" onmouseleave="removerTooltipChamadoTecnicos()">${escaparAtributo(id)}</span>`).join(' ')
}

// Cada chamado é buscado uma vez por sessão (o tooltip reaparece instantâneo depois).
const resumosChamadosTecnicos = new Map()

function resumoChamadoTecnicos(id) {
    if (!resumosChamadosTecnicos.has(id)) {
        resumosChamadosTecnicos.set(id, (async () => {
            const ocorrencia = await recuperarDado('dados_ocorrencias', id) || {}
            const cliente = ocorrencia.unidade
                ? await recuperarDado('clientes', ocorrencia.unidade) || {}
                : ocorrencia.snapshots?.cliente || {}

            // Última correção = a de data mais recente (mesma ordem da tela de ocorrências).
            const [ultima] = Object.values(ocorrencia.correcoes || {})
                .filter(c => c && typeof c === 'object')
                .sort((a, b) => toTimestamp(b.data) - toTimestamp(a.data))
            const tipo = ultima?.tipoCorrecaoNome
                || (ultima?.tipoCorrecao ? (await recuperarDado('correcoes', ultima.tipoCorrecao) || {}).nome : '')

            return { ocorrencia, cliente, ultima, tipo }
        })().catch(erro => {
            // Falha não fica guardada: na próxima passada tenta de novo.
            resumosChamadosTecnicos.delete(id)
            throw erro
        }))
    }
    return resumosChamadosTecnicos.get(id)
}

function removerTooltipChamadoTecnicos() {
    const tooltip = document.querySelector('.tooltip-chamado')
    if (!tooltip) return
    clearInterval(tooltip.vigia)
    tooltip.remove()
}

// Abaixo do chamado (ou acima, se não couber), sem sair da tela.
function posicionarTooltipChamado(tooltip, elemento) {
    const alvo = elemento.getBoundingClientRect()
    const { offsetWidth: largura, offsetHeight: altura } = tooltip
    const cabeAbaixo = alvo.bottom + 8 + altura <= window.innerHeight
    tooltip.style.top = `${Math.max(8, cabeAbaixo ? alvo.bottom + 8 : alvo.top - altura - 8)}px`
    tooltip.style.left = `${Math.max(8, Math.min(alvo.left + alvo.width / 2 - largura / 2, window.innerWidth - largura - 8))}px`
}

async function tooltipChamadoTecnicos(elemento) {
    const id = elemento.dataset.chamado
    removerTooltipChamadoTecnicos()

    const tooltip = document.createElement('div')
    tooltip.className = 'tooltip-chamado'
    tooltip.dataset.chamado = id
    tooltip.innerHTML = '<img class="tooltip-chamado-loading" src="gifs/loading.gif" alt="Carregando">'
    document.body.appendChild(tooltip)
    posicionarTooltipChamado(tooltip, elemento)
    // Se o popup fechar com o mouse em cima, o mouseleave não acontece: some junto com o chamado.
    tooltip.vigia = setInterval(() => {
        if (!elemento.isConnected) removerTooltipChamadoTecnicos()
    }, 300)

    let resumo
    try {
        resumo = await resumoChamadoTecnicos(id)
    } catch {
        resumo = null
    }

    // O mouse pode ter saído (ou ido para outro chamado) enquanto buscava.
    if (!tooltip.isConnected) return

    if (!resumo) {
        tooltip.innerHTML = '<div class="tooltip-chamado-vazio">Não foi possível carregar o chamado.</div>'
        return posicionarTooltipChamado(tooltip, elemento)
    }

    const { ocorrencia, cliente, ultima, tipo } = resumo
    const texto = valor => escaparAtributo(String(valor ?? '').trim())
    const local = [cliente.endereco, cliente.bairro, [cliente.cidade, cliente.estado].filter(Boolean).join('/')]
        .filter(Boolean).map(texto).join(' · ')
    const tecnicos = [ultima?.tecnico].flat().filter(Boolean).map(texto).join(', ')
    const linha = (rotulo, valor) => valor ? `<div class="tooltip-chamado-linha"><b>${rotulo}</b><span>${valor}</span></div>` : ''
    // Descrições são HTML (como na tela de ocorrências): vão numa div, sem escapar.
    const linhaHtml = (rotulo, html) => `
        <div class="tooltip-chamado-linha"><b>${rotulo}</b><div class="tooltip-chamado-html">${String(html ?? '').trim() || '—'}</div></div>`

    tooltip.innerHTML = `
        <div class="tooltip-chamado-titulo">Chamado ${texto(id)}</div>
        <div class="tooltip-chamado-bloco">
            ${linha('Local', texto(cliente.nome) || '—')}
            ${linha('Endereço', local)}
        </div>
        <div class="tooltip-chamado-bloco">
            ${linhaHtml('Descrição', ocorrencia.descricao)}
        </div>
        <div class="tooltip-chamado-bloco">
            ${ultima ? `
                ${linha('Última correção', `${tipo ? formatacaoTipoCorrecao(texto(tipo)) : '—'} <small>${texto(ultima.data)}</small>`)}
                ${linha('Técnico', tecnicos)}
                ${linhaHtml('Descrição da correção', ultima.descricao)}`
            : linha('Última correção', 'Nenhuma correção registrada')}
        </div>`
    posicionarTooltipChamado(tooltip, elemento)
}

// Popup do dia (mesmo estilo da lista de livres de hoje), com uma consulta de um dia só.
async function abrirDiaTecnicos(iso) {
    fecharCalendarioTecnicos()
    overlayAguarde()

    let resposta
    try {
        resposta = await chamarApiTecnicos('/tecnicos/agenda', { de: iso, ate: iso })
    } catch (erro) {
        return popup({ mensagem: erro.message })
    }

    const { dias = [], podeMarcar, tipos = [] } = resposta
    const grupo = situacao => dias.filter(l => l.situacao === situacao)
    const [ano, mes, dia] = iso.split('-').map(Number)
    const semana = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'long' })
    const local = l => [l.cidade, l.estado].filter(Boolean).map(escaparAtributo).join('/')

    const linhas = (lista, classe, extra = () => '') => lista.map(l => `
        <tr class="cal-tec-linha ${classe}">
            <td>${classe === 'indisponivel' ? '<img src="imagens/cadeado.png" alt="Indisponível">' : ''}${escaparAtributo(l.nome || l.usuario)}</td>
            <td>${local(l)}</td>
            <td>${extra(l)}</td>
        </tr>`).join('')

    const motivo = l => `
        <b>${escaparAtributo(l.motivo || 'Indisponível')}</b> · ${brDiaTecnicos(l.indisponivel_de)} a ${brDiaTecnicos(l.indisponivel_ate)}
        ${l.observacao ? `<br><small>${escaparAtributo(l.observacao)}</small>` : ''}
        ${l.chamados?.length ? `<br><small class="cal-tec-conflito">Tem correção agendada: ${etiquetasChamadosTecnicos(l.chamados)}</small>` : ''}
        ${podeMarcar ? `<button type="button" class="cal-tec-remover" title="Remover indisponibilidade"
            onclick="confirmarRemoverIndisponibilidade('${escaparAtributo(l.usuario)}', '${escaparAtributo(l.indisponibilidade_id)}', '${iso}')">✕</button>` : ''}`

    const secao = (titulo, classe, lista, extra, cabecalho) => lista.length ? `
        <h4 class="cal-tec-titulo ${classe}">${titulo} <span>${lista.length}</span></h4>
        <table class="relatorio-cc-tab cal-tec-tabela">
            <thead><tr><th>Técnico</th><th>Cidade</th><th>${cabecalho}</th></tr></thead>
            <tbody>${linhas(lista, classe, extra)}</tbody>
        </table>` : ''

    // Lista de técnicos para o formulário: todos os efetivos aparecem em todo dia.
    calendarioTecnicos.formulario = {
        iso, tipos,
        tecnicos: dias.map(l => [l.usuario, l.nome || l.usuario]).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'))
    }

    popup({
        titulo: `Técnicos em ${brDiaTecnicos(iso)}`,
        elemento: `
            <div class="tecnicos-livres-lista cal-tec-popup">
                <div class="cal-tec-popup-topo">
                    <span class="cal-tec-semana-dia">${semana}</span>
                    ${podeMarcar ? `<button type="button" onclick="formularioIndisponibilidade()"><img src="imagens/bloqueio.png" alt=""> Sinalizar técnico indisponível</button>` : ''}
                </div>
                <div class="tecnicos-livres-aviso" role="note">
                    <img src="imagens/alerta.png" alt="">
                    <span>Para o técnico aparecer aqui é necessário ter algum documento cadastrado no RH.</span>
                </div>
                ${dias.length ? '' : '<p>Nenhum técnico efetivo encontrado.</p>'}
                ${secao('Livres', 'livre', grupo('livre'), () => '', '')}
                ${secao('Indisponíveis', 'indisponivel', grupo('indisponivel'), motivo, 'Motivo')}
                ${secao('Com correção agendada', 'ocupado', grupo('ocupado'), l => etiquetasChamadosTecnicos(l.chamados), 'Chamados')}
            </div>`
    })
}

function formularioIndisponibilidade() {
    const { iso, tipos, tecnicos } = calendarioTecnicos.formulario || {}
    if (!iso) return
    const opcoes = tecnicos.map(([usuario, nome]) => `<option value="${escaparAtributo(usuario)}">${escaparAtributo(nome)}</option>`).join('')

    popup({
        titulo: 'Sinalizar técnico indisponível',
        linhas: [
            { texto: 'Técnico', elemento: `<select name="indTecnico"><option value=""></option>${opcoes}</select>` },
            { texto: 'Motivo', elemento: `<select name="indTipo">${tipos.map(t => `<option>${escaparAtributo(t)}</option>`).join('')}</select>` },
            { texto: 'De', elemento: `<input type="date" name="indInicio" value="${iso}">` },
            { texto: 'Até', elemento: `<input type="date" name="indFim" value="${iso}">` },
            { texto: 'Observação', elemento: '<textarea name="indObs" maxlength="300" placeholder="Opcional"></textarea>' }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarIndisponibilidade()' }]
    })
}

// Depois de salvar/remover: reabre o popup do dia (atualizado) e atualiza o letreiro.
async function reabrirDiaTecnicos(iso) {
    removerTodosPopups()
    atualizarTecnicosLivres()
    await abrirDiaTecnicos(iso)
}

async function salvarIndisponibilidade() {
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const valor = nome => painel?.querySelector(`[name="${nome}"]`)?.value?.trim() || ''
    const dados = { usuario: valor('indTecnico'), tipo: valor('indTipo'), inicio: valor('indInicio'), fim: valor('indFim'), obs: valor('indObs') }

    if (!dados.usuario) return popup({ mensagem: 'Escolha o técnico.' })
    if (!dados.inicio || !dados.fim || dados.fim < dados.inicio)
        return popup({ mensagem: 'Informe o período: o fim não pode ser antes do início.' })

    overlayAguarde()
    try {
        await chamarApiTecnicos('/tecnicos/indisponibilidade', dados)
        await reabrirDiaTecnicos(calendarioTecnicos.formulario?.iso || dados.inicio)
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

function confirmarRemoverIndisponibilidade(usuario, id, iso) {
    popup({
        mensagem: 'Remover esta indisponibilidade? O técnico volta a aparecer como disponível no período.',
        botoes: [{ texto: 'Remover', img: 'cancel', funcao: `removerIndisponibilidade('${usuario}', '${id}', '${iso}')` }]
    })
}

async function removerIndisponibilidade(usuario, id, iso) {
    overlayAguarde()
    try {
        await chamarApiTecnicos('/tecnicos/indisponibilidade/remover', { usuario, id })
        await reabrirDiaTecnicos(iso)
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}
