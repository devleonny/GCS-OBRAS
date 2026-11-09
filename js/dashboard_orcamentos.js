// DASHBOARD DE ORÇAMENTOS (Orçamentos > Dashboard), uso interno.
// Números prontos de /dashboard-orcamentos (dashboard_orcamentos.js no servidor); os gráficos
// são os mesmos do dashboard de chamados (dashboard_chamados.js).

const estadoDashOrc = { empresa: '', usuario: '', preset: '12m', inicio: '', fim: '' }
const SERIES_FATURAMENTO = [{ chave: 'venda', nome: 'Venda' }, { chave: 'servico', nome: 'Serviço' }]

async function telaDashboardOrcamentos() {

    const { inicio, fim } = periodoPresetDash(estadoDashOrc.preset)
    estadoDashOrc.inicio ||= inicio
    estadoDashOrc.fim ||= fim

    tela.innerHTML = `
        <div class="dash">
            <div class="dash-topo">
                <div>
                    <h2 class="dash-titulo">Dashboard de orçamentos</h2>
                    <p class="dash-subtitulo" id="dashOrcSubtitulo"></p>
                </div>
                <div class="dash-filtros">
                    <label class="dash-filtro">
                        <span>Empresa</span>
                        <select id="dashOrcEmpresa" onchange="filtrarDashOrcamentos()"></select>
                    </label>
                    <label class="dash-filtro">
                        <span>Criado por</span>
                        <select id="dashOrcUsuario" onchange="filtrarDashOrcamentos()"></select>
                    </label>
                    <label class="dash-filtro">
                        <span>Período</span>
                        <select id="dashOrcPreset" onchange="filtrarDashOrcamentos(true)">
                            <option value="30d">Últimos 30 dias</option>
                            <option value="90d">Últimos 90 dias</option>
                            <option value="ano">Este ano</option>
                            <option value="12m">Últimos 12 meses</option>
                            <option value="personalizado">Personalizado</option>
                        </select>
                    </label>
                    <label class="dash-filtro dash-datas" id="dashOrcDatas">
                        <span>De / até</span>
                        <div>
                            <input type="date" id="dashOrcInicio" onchange="filtrarDashOrcamentos()">
                            <input type="date" id="dashOrcFim" onchange="filtrarDashOrcamentos()">
                        </div>
                    </label>
                </div>
            </div>
            <div id="dashOrcConteudo" class="dash-conteudo">
                <div class="dash-carregando"><img src="gifs/loading-gcs.png" alt="Carregando"></div>
            </div>
        </div>`

    document.getElementById('dashOrcPreset').value = estadoDashOrc.preset
    document.getElementById('dashOrcInicio').value = estadoDashOrc.inicio
    document.getElementById('dashOrcFim').value = estadoDashOrc.fim
    document.getElementById('dashOrcDatas').hidden = estadoDashOrc.preset !== 'personalizado'

    await carregarDashOrcamentos()
}

async function filtrarDashOrcamentos(trocouPreset = false) {
    const preset = document.getElementById('dashOrcPreset').value
    estadoDashOrc.preset = preset
    estadoDashOrc.empresa = document.getElementById('dashOrcEmpresa').value || ''
    estadoDashOrc.usuario = document.getElementById('dashOrcUsuario').value || ''
    document.getElementById('dashOrcDatas').hidden = preset !== 'personalizado'

    if (preset !== 'personalizado') {
        Object.assign(estadoDashOrc, periodoPresetDash(preset))
    } else if (!trocouPreset) {
        estadoDashOrc.inicio = document.getElementById('dashOrcInicio').value || estadoDashOrc.inicio
        estadoDashOrc.fim = document.getElementById('dashOrcFim').value || estadoDashOrc.fim
    }
    document.getElementById('dashOrcInicio').value = estadoDashOrc.inicio
    document.getElementById('dashOrcFim').value = estadoDashOrc.fim

    await carregarDashOrcamentos()
}

async function carregarDashOrcamentos() {
    const conteudo = document.getElementById('dashOrcConteudo')
    if (!conteudo) return

    if (!conteudo.querySelector('.dash-carregando'))
        conteudo.classList.add('atualizando')

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/dashboard-orcamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ empresa: estadoDashOrc.empresa || null, usuario: estadoDashOrc.usuario || null, inicio: estadoDashOrc.inicio, fim: estadoDashOrc.fim })
        })
        const retorno = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(retorno.mensagem || 'Falha ao carregar o dashboard.')

        if (!document.getElementById('dashOrcConteudo')) return
        desenharDashOrcamentos(retorno)
    } catch (err) {
        console.error(err)
        conteudo.innerHTML = `<p class="dash-vazio">${textoDash(err.message)}</p>`
    } finally {
        conteudo.classList.remove('atualizando')
    }
}

function desenharDashOrcamentos({ empresa, periodo, empresas, usuario, usuarios = [], dados }) {

    const select = document.getElementById('dashOrcEmpresa')
    select.innerHTML = `<option value="">Todas as empresas</option>` +
        empresas.map(e => `<option value="${textoDash(e.id)}">${textoDash(e.nome)}</option>`).join('')
    select.value = empresa?.id || ''

    const selectUsuario = document.getElementById('dashOrcUsuario')
    selectUsuario.innerHTML = `<option value="">Todos os usuários</option>` +
        usuarios.map(u => `<option value="${textoDash(u)}">${textoDash(u)}</option>`).join('')
    selectUsuario.value = usuario || ''

    document.getElementById('dashOrcSubtitulo').textContent =
        `${empresa?.nome || 'Todas as empresas'}${usuario ? ` · criados por ${usuario}` : ''} · ${dataDash(periodo.inicio)} a ${dataDash(periodo.fim)}`

    const conteudo = document.getElementById('dashOrcConteudo')

    if (!dados.emitidos && !dados.faturado) {
        conteudo.innerHTML = `<p class="dash-vazio">Nenhum orçamento emitido ou faturado neste período.</p>`
        return
    }

    const etapa = nome => dados.etapas.find(e => e.nome === nome) || { quantidade: 0, valor: 0 }
    const negociacao = etapa('Em negociação'), semStatus = etapa('Sem status')
    const pct = (n, total) => total ? `${Math.round(n / total * 100)}%` : '—'
    const dias = d => d == null ? '—' : `${numeroDash(d)} ${Math.round(d) === 1 ? 'dia' : 'dias'}`
    const larguraMensal = Math.max(520, conteudo.clientWidth - 34)

    conteudo.innerHTML = `
        <section class="dash-kpis">
            <div class="dash-hero">
                <span class="dash-rotulo">Faturado no período</span>
                <span class="dash-hero-valor">${moedaDash(dados.faturado)}</span>
                ${deltaDash(dados.faturado, dados.faturadoAnterior, true, moedaDash)}
                <span class="dash-nota">Venda ${moedaDash(dados.faturadoVenda)} · Serviço ${moedaDash(dados.faturadoServico)} · ${numeroDash(dados.notas)} notas</span>
            </div>
            ${tileDash('Orçamentos emitidos', numeroDash(dados.emitidos), `<span class="dash-nota">${moedaDash(dados.emitidosValor)} orçados</span>${deltaDash(dados.emitidos, dados.emitidosAnterior, null)}`)}
            ${tileDash('Carteira a faturar', moedaDash(dados.carteira), `<span class="dash-nota">${numeroDash(dados.carteiraQtd)} orçamentos aprovados ou em execução</span>`)}
            ${tileDash('Ticket médio', moedaDash(dados.ticketMedio), '<span class="dash-nota">por orçamento emitido</span>')}
            ${tileDash('Prazo até faturar', dias(dados.diasAteFaturar), '<span class="dash-nota">mediana, da emissão à 1ª nota</span>')}
        </section>

        <section class="dash-atividades" aria-label="Acompanhamento dos orçamentos do período">
            ${atividadeOrc('Emitidos já faturados', numeroDash(dados.faturadosDoPeriodo), pct(dados.faturadosDoPeriodo, dados.emitidos))}
            ${atividadeOrc('Em negociação', numeroDash(negociacao.quantidade), moedaDash(negociacao.valor))}
            ${atividadeOrc('Ligados a chamados', numeroDash(dados.vinculadosChamado), pct(dados.vinculadosChamado, dados.emitidos))}
            ${atividadeOrc('Remessas', numeroDash(dados.remessas), moedaDash(dados.remessasValor))}
            ${atividadeOrc('Sem status', numeroDash(semStatus.quantidade), moedaDash(semStatus.valor))}
        </section>

        <section class="dash-linha dash-linha-mapa">
            <div class="dash-card">
                <h3>Faturamento por estado</h3>
                ${mapaDash(dados.porEstado, { formatar: moedaDash, descrever: moedaDash })}
            </div>
            <div class="dash-card">
                <h3>Ranking de estados</h3>
                ${barrasDash(dados.porEstado.map(e => ({ nome: e.uf, quantidade: e.quantidade })), { total: dados.faturado, formatar: moedaDash })}
            </div>
        </section>

        <section class="dash-card">
            <h3>Faturamento por mês</h3>
            ${mensalDash(dados.mensal, larguraMensal, { series: SERIES_FATURAMENTO, formatar: moedaCompletaDash, eixo: moedaDash })}
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Etapa dos orçamentos emitidos</h3>
                ${barrasDash(dados.etapas, { total: dados.emitidos, complemento: e => moedaDash(e.valor) })}
            </div>
            <div class="dash-card">
                <h3>Status dos orçamentos emitidos</h3>
                ${barrasDash(dados.status, { total: dados.emitidos })}
            </div>
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Faturamento por empresa</h3>
                ${barrasDash(dados.empresas, { total: dados.faturado, formatar: moedaDash })}
            </div>
            <div class="dash-card">
                <h3>Valor orçado por LPU</h3>
                ${barrasDash(dados.lpus, { total: dados.emitidosValor, formatar: moedaDash })}
            </div>
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Orçamentos por usuário</h3>
                ${barrasDash(dados.usuarios, { complemento: u => moedaDash(u.valor) })}
            </div>
            <div class="dash-card">
                <h3>Clientes que mais faturaram</h3>
                ${clientesOrc(dados.clientes)}
            </div>
        </section>

        <p class="dash-nota">Fora da análise: orçamentos reprovados e pedidos internos de ferramenta. Faturamento conta só notas de venda e serviço
            ligadas a orçamentos, pela parte de cada orçamento; antes de nov/2025 a maioria das notas não tem esse vínculo.</p>`

    ligarTooltipsDash(conteudo)
}

function atividadeOrc(rotulo, valor, detalhe) {
    return `<div class="dash-atividade"><span class="dash-valor">${valor}</span><span class="dash-rotulo">${rotulo}</span><span class="dash-nota">${detalhe}</span></div>`
}

function clientesOrc(clientes = []) {
    if (!clientes.length) return '<p class="dash-vazio">Sem faturamento no período.</p>'
    const maximo = Math.max(...clientes.map(c => c.quantidade)) || 1
    return `
        <table class="dash-tabela">
            <thead><tr><th>Cliente</th><th>UF</th><th>Faturado</th></tr></thead>
            <tbody>${clientes.map(c => `
                <tr>
                    <td>${textoDash(c.nome)}</td>
                    <td>${textoDash(c.uf)}</td>
                    <td><span class="dash-celula-barra"><i style="width: ${c.quantidade / maximo * 100}%"></i><b>${moedaDash(c.quantidade)}</b></span></td>
                </tr>`).join('')}
            </tbody>
        </table>`
}
