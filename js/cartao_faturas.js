// Faturas do cartão de crédito (Financeiro → Faturas do Cartão), layout financeiro.
// Servidor: gcs SCRIPTS/financeiro.js (rotas /financeiro/cartao/*) e migrations/financeiro-cartao-faturas.sql.
//
// Cada cartão (Contas correntes, tipo Cartão) tem uma fatura por mês. As compras são o que foi pago no cartão
// (reembolso com forma Cartão, ou linha lançada aqui na conferência) e caem sozinhas na fatura aberta mais antiga.
// Conferir = informar o total da fatura do banco (+ PDF), lançar o que falta e mover o que o banco jogou para o mês
// seguinte, até a diferença zerar; aí "Fechar fatura". Pagar (total ou parcial) = transferência da conta que paga
// para a conta do cartão: não é custo. O que não foi pago vira o saldo anterior da fatura seguinte.

const estadoCartoesFin = { todas: false }
let faturaCartaoAtual = null
let anexosCartaoFin = []

const SITUACOES_CARTAO_FIN = {
    ABERTA: ['Aberta', 'cf-chip-aberta'],
    FECHADA: ['A pagar', 'cf-chip-fechada'],
    PAGA: ['Paga', 'cf-chip-paga'],
    'PAGA PARCIAL': ['Paga parcial', 'cf-chip-parcial']
}
const chipCartaoFin = s => {
    const [texto, classe] = SITUACOES_CARTAO_FIN[s] || [s, '']
    return `<span class="cf-chip ${classe}">${escFin(texto)}</span>`
}
const mesCartaoFin = v => {
    const [ano, mes] = String(v || '').slice(0, 7).split('-')
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return ano ? `${nomes[Number(mes) - 1]}/${ano}` : ''
}
const diasAteFin = iso => Math.round((new Date(`${String(iso).slice(0, 10)}T12:00:00`) - new Date(new Date().toDateString() + ' 12:00')) / 86400000)

// ------------------------------------------------------------ lista

async function telaFaturasCartaoFin() {
    overlayAguarde()
    try {
        const { faturas, sem_vencimento: semVencimento = [] } = await apiFin('cartao/faturas', { todas: estadoCartoesFin.todas })
        removerOverlay()
        const abertas = faturas.filter(f => !['PAGA', 'PAGA PARCIAL'].includes(f.situacao))
        const somaAPagar = abertas.reduce((a, f) => a + Number(f.a_pagar || 0), 0)
        tela.innerHTML = `
            <div class="fis-pagina fin-tela">
                <section class="fin-janela">
                    <header class="fin-janela-topo">
                        <h2>Faturas do cartão</h2>
                        <div class="fin-barra">
                            <button type="button" onclick="estadoCartoesFin.todas = !estadoCartoesFin.todas; telaFaturasCartaoFin()">
                                ${iconeFin(estadoCartoesFin.todas ? 'fechar' : 'ver')} ${estadoCartoesFin.todas ? 'Esconder as pagas antigas' : 'Mostrar todas as pagas'}</button>
                            <button type="button" onclick="telaContasFin()">${iconeFin('editar')} Cadastro dos cartões</button>
                        </div>
                    </header>
                    <div class="cf-resumo">
                        <div><small>Faturas em aberto</small><b>${abertas.length}</b></div>
                        <div><small>A pagar (conferido + estimado)</small><b>${dinheiro(somaAPagar)}</b></div>
                        <div><small>Vencendo em 7 dias</small><b>${abertas.filter(f => diasAteFin(f.vencimento) <= 7).length}</b></div>
                    </div>
                    ${semVencimento.length ? `<div class="cf-aviso">Cartões ativos sem dia de vencimento (não geram fatura):
                        ${semVencimento.map(k => `<span class="fis-link" onclick="formularioContaFin('${escFin(k.id)}')">${escFin(k.nome)}</span>`).join(', ')}</div>` : ''}
                    <div class="fis-tabela-rolagem cf-rolagem">
                        <table class="fis-tabela fin-extrato cf-tabela">
                            <thead><tr>
                                <th>Vence</th><th>Cartão</th><th>Fatura</th><th>Situação</th>
                                <th class="fis-num">Lançado</th><th class="fis-num">Estimado</th><th class="fis-num">Fatura do banco</th>
                                <th class="fis-num">Pago</th><th class="fis-num">A pagar</th>
                            </tr></thead>
                            <tbody>${faturas.map(f => {
                                const d = diasAteFin(f.vencimento)
                                const alerta = !['PAGA', 'PAGA PARCIAL'].includes(f.situacao) && d <= 7
                                return `
                                <tr class="cf-linha ${alerta ? 'cf-alerta' : ''}" onclick="telaFaturaCartaoFin('${escFin(f.id)}')">
                                    <td>${dataFin(f.vencimento)}${alerta ? `<small class="cf-dias">${d < 0 ? `venceu há ${-d} d` : d === 0 ? 'hoje' : `em ${d} d`}</small>` : ''}</td>
                                    <td><b>${escFin(f.cartao)}</b><small class="cf-sub">${escFin(f.app)}${f.conta_pagadora_nome ? ` · paga pelo ${escFin(f.conta_pagadora_nome)}` : ''}</small></td>
                                    <td>${mesCartaoFin(f.mes)}</td>
                                    <td>${chipCartaoFin(f.situacao)}</td>
                                    <td class="fis-num">${dinheiro(f.lancado)}<small class="cf-sub">${f.n_compras} compra${f.n_compras === 1 ? '' : 's'}</small></td>
                                    <td class="fis-num">${f.estimado != null ? dinheiro(f.estimado) : '—'}</td>
                                    <td class="fis-num">${f.total_banco != null ? dinheiro(f.total_banco) : '—'}</td>
                                    <td class="fis-num">${Number(f.pago) ? dinheiro(f.pago) : '—'}</td>
                                    <td class="fis-num"><b>${Number(f.a_pagar) ? dinheiro(f.a_pagar) : '—'}</b></td>
                                </tr>`
                            }).join('') || '<tr><td colspan="9" class="fis-vazio">Nenhuma fatura de cartão.</td></tr>'}</tbody>
                        </table>
                    </div>
                </section>
            </div>`
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ------------------------------------------------------------ uma fatura (conferência e pagamento)

async function telaFaturaCartaoFin(id) {
    overlayAguarde()
    try {
        const [dados] = await Promise.all([apiFin('cartao/fatura', { id }), carregarOpcoesFin()])
        removerOverlay()
        faturaCartaoAtual = dados
        anexosCartaoFin = Array.isArray(dados.fatura.anexos) ? [...dados.fatura.anexos] : []
        desenharFaturaCartaoFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function desenharFaturaCartaoFin() {
    const { fatura: f, compras, pagamentos, anterior, proxima } = faturaCartaoAtual
    const aberta = f.estado === 'ABERTA'
    const dif = Number(f.diferenca)
    const zerada = f.total_banco != null && Math.abs(dif) < 0.005
    const falta = Math.max(Number(f.total_banco || 0) - Number(f.pago || 0), 0)
    const dica = c => [c.cliente_documento && `CPF/CNPJ ${c.cliente_documento}`, [c.cliente_cidade, c.cliente_uf].filter(Boolean).join('/'),
        c.cliente_telefone, c.cliente_email].filter(Boolean).join(' · ')
    tela.innerHTML = `
        <div class="fis-pagina fin-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Fatura ${escFin(f.cartao)} · ${mesCartaoFin(f.mes)}</h2>
                    <div class="fin-barra">
                        <button type="button" onclick="telaFaturasCartaoFin()">${iconeFin('voltar')} Faturas do cartão</button>
                        ${anterior ? `<button type="button" onclick="telaFaturaCartaoFin('${escFin(anterior.id)}')">${iconeFin('seta')} ${mesCartaoFin(anterior.mes)}</button>` : ''}
                        ${proxima ? `<button type="button" onclick="telaFaturaCartaoFin('${escFin(proxima.id)}')">${mesCartaoFin(proxima.mes)} ${iconeFin('seta')}</button>` : ''}
                        ${aberta ? `<button type="button" ${zerada ? '' : 'disabled title="A diferença tem que estar zerada (e o total do banco informado)"'} onclick="fecharFaturaCartaoFin()">${iconeFin('check')} Fechar fatura</button>` : ''}
                        ${!aberta && !Number(f.pago) ? `<button type="button" onclick="reabrirFaturaCartaoFin()">${iconeFin('editar')} Reabrir</button>` : ''}
                        ${f.estado === 'FECHADA' && falta > 0.005 && !Number(f.pago) ? `<button type="button" onclick="formularioPagarCartaoFin()">${iconeFin('baixa')} Pagar</button>` : ''}
                    </div>
                </header>

                <div class="cf-resumo">
                    <div><small>Vence</small><b>${dataFin(f.vencimento)}</b>${chipCartaoFin(f.situacao)}</div>
                    <div class="cf-total-banco"><small>Fatura do banco</small>
                        ${aberta
                            ? `<input class="fis-input fis-num" type="number" step="0.01" min="0" value="${f.total_banco ?? ''}" placeholder="total do PDF" onchange="salvarTotalCartaoFin(this.value)">`
                            : `<b>${dinheiro(f.total_banco)}</b>`}
                        <label class="cf-anexar">${iconeFin('anexo')} PDF<input type="file" multiple hidden onchange="anexarCartaoFin(this)"></label>
                        <div class="cf-anexos">${anexosCartaoFin.map((a, i) => criarAnexoVisual(a.nome || a.link, a.link, `removerAnexoCartaoFin(${i})`)).join('')}</div>
                    </div>
                    <div><small>Saldo anterior não pago</small><b>${dinheiro(f.saldo_anterior)}</b></div>
                    <div><small>Compras (${compras.length})</small><b>${dinheiro(f.compras)}</b></div>
                    <div class="${f.total_banco == null ? '' : zerada ? 'cf-ok' : 'cf-falta'}"><small>${f.total_banco == null ? 'Diferença' : zerada ? 'Conferida' : 'Falta explicar'}</small>
                        <b>${f.total_banco == null ? '—' : zerada ? '✔ R$ 0,00' : dinheiro(dif)}</b></div>
                    <div><small>Pago</small><b>${dinheiro(f.pago)}</b>${f.estimado != null && aberta ? `<small>estimado ~${dinheiro(f.estimado)}</small>` : ''}</div>
                </div>

                <div class="fis-tabela-rolagem cf-rolagem-compras">
                    <table class="fis-tabela fin-extrato cf-tabela">
                        <thead><tr><th>Data</th><th>Fornecedor</th><th>Categoria</th><th>Departamento</th><th>Origem</th><th class="fis-num">Valor</th><th></th></tr></thead>
                        <tbody>${compras.map(c => `
                            <tr>
                                <td>${dataFin(c.data)}</td>
                                <td><span class="${c.cliente_id ? 'cf-vinculo' : ''}" title="${escFin(dica(c))}">${escFin(c.participante_nome || '—')}</span>
                                    ${c.observacao ? `<small class="cf-sub" title="${escFin(c.observacao)}">${escFin(c.observacao)}</small>` : ''}</td>
                                <td>${escFin(c.categoria || '—')}</td>
                                <td>${escFin(c.departamentos || '—')}</td>
                                <td><small>${c.origem === 'REEMBOLSO' ? `Reembolso · ${escFin(c.criado_por || '')}` : c.origem === 'CARTAO' ? 'Lançado na conferência' : escFin(c.origem)}</small></td>
                                <td class="fis-num ${Number(c.valor) < 0 ? 'fis-positivo' : ''}"><b>${dinheiro(c.valor)}</b></td>
                                <td class="cf-acoes">${aberta ? `
                                    ${anterior?.estado === 'ABERTA' ? `<button type="button" class="fis-mini" title="Voltar para ${mesCartaoFin(anterior.mes)}" onclick="moverCompraCartaoFin('${escFin(c.baixa_id)}', 'anterior')">◂</button>` : ''}
                                    <button type="button" class="fis-mini" title="Não veio nesta fatura: passar para a do mês seguinte" onclick="moverCompraCartaoFin('${escFin(c.baixa_id)}', 'proxima')">▸</button>
                                    ${c.origem === 'CARTAO' && String(c.origem_id || '').startsWith('linha:') ? `<button type="button" class="fis-remover-linha" title="Tirar esta linha" onclick="excluirLinhaCartaoFin('${escFin(c.titulo_id)}')">${iconeLixeiraFis}</button>` : ''}` : ''}</td>
                            </tr>`).join('') || '<tr><td colspan="7" class="fis-vazio">Nenhuma compra nesta fatura ainda.</td></tr>'}</tbody>
                    </table>
                </div>

                ${aberta ? `
                <div class="cf-lancar">
                    <b>Lançar o que está na fatura do banco e não está acima</b>
                    <small>Administrativo, assinatura, anuidade, IOF, juros… Valor negativo = estorno ou crédito.</small>
                    <div class="cf-lancar-linha" data-linha-cartao>
                        <input class="fis-input" type="date" name="data" value="${new Date().toISOString().slice(0, 10)}">
                        <div class="fin-escolha cf-fornecedor" data-cliente="">
                            <input class="fis-input" name="fornecedor" placeholder="Fornecedor (onde foi a compra)" autocomplete="off"
                                oninput="buscarFornecedorCartaoFin(this)" onblur="setTimeout(() => this.closest('.fin-escolha').querySelector('.fin-escolha-lista').hidden = true, 150)">
                            <div class="fin-escolha-lista" hidden></div>
                        </div>
                        <div class="fin-escolha" data-categoria-cartao data-valor="">
                            <input class="fis-input" placeholder="Categoria…" autocomplete="off"
                                onfocus="this.select(); buscarCategoriaCartaoFin(this)" oninput="buscarCategoriaCartaoFin(this)" onblur="setTimeout(() => fecharCategoriaCartaoFin(this), 150)">
                            <div class="fin-escolha-lista" hidden></div>
                        </div>
                        <div class="fin-escolha" data-valor="">
                            <input class="fis-input" placeholder="Departamento…" autocomplete="off"
                                onfocus="this.select(); buscarDepFin(this)" oninput="buscarDepFin(this)" onblur="setTimeout(() => fecharBuscaDepFin(this), 150)">
                            <div class="fin-escolha-lista" hidden></div>
                        </div>
                        <input class="fis-input fis-num" type="number" step="0.01" name="valor" placeholder="R$" value="${f.total_banco != null && dif > 0 ? dif.toFixed(2) : ''}">
                        <button type="button" class="fis-botao" onclick="lancarLinhaCartaoFin(this)">+ Lançar</button>
                    </div>
                </div>` : ''}

                ${pagamentos.length ? `
                <div class="cf-pagamentos">
                    <b>Pagamentos</b>
                    ${pagamentos.map(p => `
                        <div class="cf-pagamento">
                            <span>${dataFin(p.data)} · ${escFin(p.app)} · ${escFin(p.conta)} · <b>${dinheiro(p.valor)}</b> <small>por ${escFin(p.criado_por || '')}</small></span>
                            ${(p.anexos || []).map(a => criarAnexoVisual(a.nome || a.link, a.link)).join('')}
                            <button type="button" class="fis-mini" onclick="desfazerPagamentoCartaoFin('${escFin(p.grupo)}')">Desfazer</button>
                        </div>`).join('')}
                    ${f.situacao === 'PAGA PARCIAL' ? `<small>Pagamento parcial: o restante (${dinheiro(falta)}) passa para a fatura seguinte como saldo anterior; os juros entram lá.</small>` : ''}
                </div>` : ''}
            </section>
        </div>`
}

async function acaoCartaoFin(rota, corpo, mensagemOk = null) {
    try {
        overlayAguarde()
        const r = await apiFin(rota, corpo)
        removerOverlay()
        await telaFaturaCartaoFin(faturaCartaoAtual.fatura.id)
        if (mensagemOk) popup({ mensagem: mensagemOk, tempo: 3 })
        return r
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

const salvarTotalCartaoFin = valor => acaoCartaoFin('cartao/fatura/salvar', { id: faturaCartaoAtual.fatura.id, total_banco: valor })

async function anexarCartaoFin(input) {
    if (!input.files?.length) return
    overlayAguarde()
    const enviados = await importarAnexos({ input })
    removerOverlay()
    input.value = ''
    if (!Array.isArray(enviados)) return
    for (const a of enviados) if (a?.link) anexosCartaoFin.push({ nome: a.nome || a.link, link: a.link })
    acaoCartaoFin('cartao/fatura/salvar', { id: faturaCartaoAtual.fatura.id, anexos: anexosCartaoFin })
}

function removerAnexoCartaoFin(i) {
    anexosCartaoFin.splice(i, 1)
    acaoCartaoFin('cartao/fatura/salvar', { id: faturaCartaoAtual.fatura.id, anexos: anexosCartaoFin })
}

const moverCompraCartaoFin = (baixaId, para) => acaoCartaoFin('cartao/mover', { baixa_id: baixaId, para })

async function excluirLinhaCartaoFin(tituloId) {
    if (!await confirmarPopup({ titulo: 'Tirar linha', mensagem: 'Tirar esta linha da conferência? A compra é cancelada.', textoConfirmar: 'Tirar' })) return
    acaoCartaoFin('cartao/linha/excluir', { titulo_id: tituloId })
}

async function fecharFaturaCartaoFin() {
    const f = faturaCartaoAtual.fatura
    if (!await confirmarPopup({ titulo: 'Fechar fatura', mensagem: `Fechar a fatura ${f.cartao} de ${mesCartaoFin(f.mes)} com ${dinheiro(f.total_banco)}? As compras ficam presas a ela e ela entra no Fluxo de Caixa para ${dataFin(f.vencimento)}.`, textoConfirmar: 'Fechar' })) return
    acaoCartaoFin('cartao/fechar', { id: f.id }, 'Fatura fechada')
}

async function reabrirFaturaCartaoFin() {
    if (!await confirmarPopup({ titulo: 'Reabrir fatura', mensagem: 'Reabrir para corrigir a conferência?', textoConfirmar: 'Reabrir' })) return
    acaoCartaoFin('cartao/reabrir', { id: faturaCartaoAtual.fatura.id })
}

async function desfazerPagamentoCartaoFin(grupo) {
    if (!await confirmarPopup({ titulo: 'Desfazer pagamento', mensagem: 'Desfazer este pagamento da fatura do cartão? A saída da conta e a entrada no cartão são canceladas.', textoConfirmar: 'Desfazer' })) return
    acaoCartaoFin('cartao/pagamento/desfazer', { id: faturaCartaoAtual.fatura.id, grupo })
}

// Fornecedor: texto livre; sugere do cadastro (rota participantes) e, escolhido, guarda o vínculo (dica com os dados).
let buscaFornecedorCartaoTimer = null
function buscarFornecedorCartaoFin(input) {
    const caixa = input.closest('.fin-escolha')
    caixa.dataset.cliente = ''
    clearTimeout(buscaFornecedorCartaoTimer)
    const termo = input.value.trim()
    const lista = caixa.querySelector('.fin-escolha-lista')
    if (termo.length < 2) { lista.hidden = true; return }
    buscaFornecedorCartaoTimer = setTimeout(async () => {
        const { participantes = [] } = await apiFin('participantes', { termo }).catch(() => ({}))
        lista.innerHTML = participantes.map(p => `
            <button type="button" class="fin-escolha-item" onmousedown="event.preventDefault(); escolherFornecedorCartaoFin(this, '${escFin(p.id)}', '${escFin(p.nome)}')">
                <b>${escFin(p.nome)}</b> <span>${escFin([p.cnpj, p.cidade].filter(Boolean).join(' · '))}</span>
            </button>`).join('') || '<div class="fin-escolha-vazio">Sem cadastro com esse nome: fica só o nome digitado.</div>'
        lista.hidden = false
    }, 250)
}

function escolherFornecedorCartaoFin(botao, id, nome) {
    const caixa = botao.closest('.fin-escolha')
    caixa.dataset.cliente = id
    caixa.querySelector('input').value = nome
    caixa.querySelector('.fin-escolha-lista').hidden = true
}

// Categoria: lista fechada de despesas (mesmo jeito da fatura).
function buscarCategoriaCartaoFin(input) {
    const caixa = input.closest('.fin-escolha')
    const lista = caixa.querySelector('.fin-escolha-lista')
    const termo = normalFin(input.value)
    const filtro = termo && termo !== normalFin(rotuloCatFin(categoriaFinPorId(caixa.dataset.valor))) ? termo : ''
    const achados = (opcoesFinCache?.categorias || []).filter(c => aceitaCatFin(c, 'PAGAR') && c.tipo !== 'TRANSFERENCIA')
        .filter(c => !filtro || normalFin(`${c.codigo} ${c.nome}`).includes(filtro)).slice(0, 50)
    lista.innerHTML = achados.map(c => `
        <button type="button" class="fin-escolha-item" onmousedown="event.preventDefault(); escolherCategoriaCartaoFin(this, '${escFin(c.id)}')">
            <b>${escFin(c.codigo)}</b> <span>${escFin(c.nome)}</span>
        </button>`).join('') || '<div class="fin-escolha-vazio">Nada encontrado: só categorias da lista.</div>'
    lista.hidden = false
}

function escolherCategoriaCartaoFin(botao, id) {
    const caixa = botao.closest('.fin-escolha')
    caixa.dataset.valor = id
    caixa.querySelector('input').value = rotuloCatFin(categoriaFinPorId(id))
    caixa.querySelector('.fin-escolha-lista').hidden = true
}

function fecharCategoriaCartaoFin(input) {
    const caixa = input.closest('.fin-escolha')
    caixa.querySelector('.fin-escolha-lista').hidden = true
    input.value = rotuloCatFin(categoriaFinPorId(caixa.dataset.valor))
}

async function lancarLinhaCartaoFin(botao) {
    const linha = botao.closest('[data-linha-cartao]')
    const fornecedor = linha.querySelector('.cf-fornecedor')
    const escolhas = linha.querySelectorAll('.fin-escolha[data-valor]')
    const r = await acaoCartaoFin('cartao/linha', {
        fatura_id: faturaCartaoAtual.fatura.id,
        data: linha.querySelector('[name="data"]').value,
        participante_nome: fornecedor.querySelector('input').value,
        cliente_id: fornecedor.dataset.cliente || null,
        categoria_id: escolhas[0]?.dataset.valor || null,
        departamento: escolhas[1]?.dataset.valor || null,
        valor: linha.querySelector('[name="valor"]').value
    })
    if (r) document.querySelector('[data-linha-cartao] [name="fornecedor"]')?.focus()
}

function formularioPagarCartaoFin() {
    const { fatura: f, contas } = faturaCartaoAtual
    const falta = Math.max(Number(f.total_banco || 0) - Number(f.pago || 0), 0)
    anexosPagarCartaoFin = []
    popup({
        titulo: `Pagar fatura ${f.cartao} · ${mesCartaoFin(f.mes)}`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-pagar-cartao>
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>Conta que pagou</span><select class="fis-input" name="conta_id">
                            ${contas.map(k => `<option value="${escFin(k.id)}" ${String(k.id) === String(f.conta_pagadora_id) ? 'selected' : ''}>${escFin(k.app)} · ${escFin(k.nome)}</option>`).join('')}
                        </select></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Data</span><input class="fis-input" type="date" name="data" value="${new Date().toISOString().slice(0, 10)}"></label>
                        <label class="fis-campo"><span>Valor pago</span><input class="fis-input fis-num" type="number" step="0.01" min="0.01" max="${falta.toFixed(2)}" name="valor" value="${falta.toFixed(2)}"></label>
                    </div>
                    <small>Pagou menos que ${dinheiro(falta)}? O restante passa para a próxima fatura como saldo anterior (os juros entram lá).</small>
                    <label class="fis-campo"><span>Comprovante</span><input type="file" multiple onchange="anexarPagarCartaoFin(this)"></label>
                    <div data-anexos-pagar-cartao></div>
                    <label class="fis-campo"><span>Observação</span><input class="fis-input" name="observacao" maxlength="500"></label>
                </div>`
        }],
        botoes: [{ texto: 'Pagar', img: 'concluido', funcao: 'pagarCartaoFin(this)' }]
    })
}

let anexosPagarCartaoFin = []
async function anexarPagarCartaoFin(input) {
    if (!input.files?.length) return
    overlayAguarde()
    const enviados = await importarAnexos({ input })
    removerOverlay()
    if (!Array.isArray(enviados)) return
    for (const a of enviados) if (a?.link) anexosPagarCartaoFin.push({ nome: a.nome || a.link, link: a.link })
    document.querySelector('[data-anexos-pagar-cartao]').innerHTML = anexosPagarCartaoFin.map(a => criarAnexoVisual(a.nome, a.link)).join('')
}

async function pagarCartaoFin(botao) {
    const form = document.querySelector('[data-pagar-cartao]')
    const v = n => form.querySelector(`[name="${n}"]`).value
    try {
        overlayAguarde()
        await apiFin('cartao/pagar', {
            id: faturaCartaoAtual.fatura.id, conta_id: v('conta_id'), data: v('data'), valor: v('valor'),
            observacao: v('observacao'), anexos: anexosPagarCartaoFin
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        await telaFaturaCartaoFin(faturaCartaoAtual.fatura.id)
        popup({ mensagem: 'Pagamento registrado', tempo: 3 })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}
