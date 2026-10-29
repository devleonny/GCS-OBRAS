// Relatório de Custos por Departamento: vw_relatorio_custos_departamentos
// (gcs/SQL/relatorio_custos_departamentos.sql), com as mesmas fontes do Painel de Custos
// (orçado e custo), para não divergir do centro de custo.

// Acima deste percentual de custo sobre o orçado o departamento fica em alerta (mesmo limite do velocímetro).
const LIMITE_CUSTO_ORCADO = 40

function moedaCC(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function percentualCC(valor) {
    return Number.isFinite(valor)
        ? `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
        : '—'
}


// ---------------------------------------------------------------------------
// Custos por Departamento: lista paginada de todos os departamentos, com o custo sobre o orçado.
// A pesquisa por coluna é a do modTab.
// ---------------------------------------------------------------------------

const PAG_CUSTOS_DEPARTAMENTOS = 'custosDepartamentos'
const BASE_CUSTOS_DEPARTAMENTOS = 'vw_relatorio_custos_departamentos'

async function telaCustosDepartamentos() {

    try {

        overlayAguarde()

        const tabela = await modTab({
            pag: PAG_CUSTOS_DEPARTAMENTOS,
            base: BASE_CUSTOS_DEPARTAMENTOS,
            body: 'bodyCustosDepartamentos',
            criarLinha: 'criarLinhaCustoDepartamento',
            // Desempate pelo nome: sem ele, departamentos com o mesmo custo trocam de página.
            ordenar: [
                { path: 'custo', direcao: 'desc', tipoOrdenacao: 'numero' },
                { path: 'departamento', direcao: 'asc' }
            ],
            // Nos números a pesquisa é "a partir de": 40 em Custo / Orçado mostra quem está em 40% ou mais.
            colunas: {
                'Centro de custo': {},
                'Custo / Orçado': { chave: 'percentual', op: '>=', tipoOrdenacao: 'numero' },
                'Departamento': { chave: 'departamento' },
                'Cliente': { chave: 'cliente' },
                'Cidade': { chave: 'cidade' },
                'Orçado': { chave: 'orcado', op: '>=', tipoOrdenacao: 'numero' },
                'Custo': { chave: 'custo', op: '>=', tipoOrdenacao: 'numero' }
            }
        })

        tela.innerHTML = `
            <div class="pagina-conteudo relatorio-departamentos">
                <div class="cabecalho-pagina"><h2>Custos por Departamento</h2></div>
                ${tabela}
            </div>
        `

        await paginacao(PAG_CUSTOS_DEPARTAMENTOS)

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o relatório de custos: ${err.message || 'fale com o suporte.'}` })
    }

}

// Mesmas faixas do velocímetro: atenção 10 pontos antes do limite, crítico no limite, azul acima de 100%.
function faixaCustoDepartamento(percentual) {
    if (percentual > 100) return 'estourado'
    if (percentual >= LIMITE_CUSTO_ORCADO) return 'critico'
    if (percentual >= LIMITE_CUSTO_ORCADO - 10) return 'alerta'
    return 'ok'
}

// Meio arco compacto. pathLength="100" faz o traço preenchido ser o próprio percentual.
function arcoCustoDepartamento(percentual) {
    const preenchido = Math.max(0, Math.min(100, percentual))
    const arco = 'M 8 44 A 36 36 0 0 1 80 44'
    return `
        <svg class="medidor-cc__arco" viewBox="0 0 88 50" aria-hidden="true">
            <path class="medidor-cc__trilha" d="${arco}" pathLength="100"></path>
            <path class="medidor-cc__progresso" d="${arco}" pathLength="100" stroke-dasharray="${preenchido} 100"></path>
            <line class="medidor-cc__limite" x1="${44 - 36 * Math.cos(Math.PI * LIMITE_CUSTO_ORCADO / 100)}" y1="${44 - 36 * Math.sin(Math.PI * LIMITE_CUSTO_ORCADO / 100)}"
                x2="${44 - 26 * Math.cos(Math.PI * LIMITE_CUSTO_ORCADO / 100)}" y2="${44 - 26 * Math.sin(Math.PI * LIMITE_CUSTO_ORCADO / 100)}"></line>
        </svg>`
}

function medidorCustoDepartamento(percentual) {
    if (!Number.isFinite(percentual))
        return '<span class="medidor-cc medidor-cc--vazio" title="Sem orçamento vinculado">—</span>'

    return `
        <span class="medidor-cc medidor-cc--${faixaCustoDepartamento(percentual)}" title="${percentualCC(percentual)} do orçado (limite ${LIMITE_CUSTO_ORCADO}%)">
            ${arcoCustoDepartamento(percentual)}
            <b>${percentualCC(percentual)}</b>
        </span>`
}

function criarLinhaCustoDepartamento(d) {

    const orcado = Number(d.orcado) || 0
    const custo = Number(d.custo) || 0
    const percentual = d.percentual === null || d.percentual === '' ? NaN : Number(d.percentual)

    const texto = valor => escaparAtributo(valor || '—')

    return `
        <tr>
            <td style="text-align: center;">
                ${d.tem_centro_custo
                    ? `<img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" title="Painel de custos"
                        onclick="painelCustos(this.dataset.departamento)" data-departamento="${escaparAtributo(d.departamento)}">`
                    : '<span title="Sem centro de custo criado">—</span>'}
            </td>
            <td class="relatorio-departamentos-medidor">${medidorCustoDepartamento(percentual)}</td>
            <td>${escaparAtributo(d.departamento)}</td>
            <td>${texto(d.cliente)}</td>
            <td>${texto(d.cidade)}</td>
            <td class="relatorio-departamentos-numero">${orcado ? moedaCC(orcado) : '—'}</td>
            <td class="relatorio-departamentos-numero">${moedaCC(custo)}</td>
        </tr>`
}
