// CHECKLIST A PARTIR DE ORÇAMENTO: escolher o orçamento, montar/editar os itens e excluir/restaurar.
// Regras no servidor (gcs/SCRIPTS/planos_diarios_projetos.js); o dia a dia é o de planos_diarios.js.

fontesEscolha.orcamentosDiario = {
    valor: 'id', rotulo: o => [o.contrato, o.cliente].filter(Boolean).join(' · '), detalhe: o => o.cidade || '', limite: 40,
    buscar: async (palavras, campo, termo) => (await apiPlanoDiario('orcamentos', { termo })).orcamentos
}

// itens: [{ id, marcado, descricao, unidade, previsto, inicial, origem (nome no orçamento), executado }]
let montagemDiario = null

function adicionarOrcamentoDiario() {
    montagemDiario = null
    const id = popup({
        titulo: 'Adicionar orçamento ao checklist',
        elemento: `
            <div class="dp-form">
                <div class="dp-campos">
                    <label style="flex-basis: 100%;">Orçamento
                        ${campoEscolhaHtml({ fonte: 'orcamentosDiario', name: 'orcamentoDiario', placeholder: 'Pesquise pelo número, cliente ou cidade…', aoMudar: 'carregarOrcamentoDiario' })}</label>
                </div>
                <div id="montagemDiario" style="min-height: 300px;"></div>
            </div>`,
        botoes: [{ texto: 'Criar checklist', img: 'concluido', funcao: 'salvarMontagemDiario()' }]
    })
    document.querySelector(`[id="${id}"] .ce-input`)?.focus()
}

async function carregarOrcamentoDiario(campo) {
    const local = campo.closest('.dp-form').querySelector('#montagemDiario')
    const id = lerEscolha(campo)
    montagemDiario = null
    local.innerHTML = id ? '<p class="diario-vazio">Carregando itens…</p>' : ''
    if (!id) return
    try {
        const { orcamento, itens, excluido } = await apiPlanoDiario('itens', { orcamento: id })
        if (lerEscolha(campo) !== id || !local.isConnected) return
        // Serviço vira atividade; material só entra marcado quando o orçamento não tem serviço nenhum.
        const temServico = itens.some(i => i.tipo === 'SERVIÇO')
        montagemDiario = {
            popup: campo.closest('.popup').id, orcamento: id, temServico,
            itens: itens.map(i => ({ ...itemDoOrcamentoDiario(i), marcado: i.qtde > 0 && (!temServico || i.tipo === 'SERVIÇO') }))
        }
        local.innerHTML = `
            ${excluido ? `<div class="dp-aviso">Este orçamento já teve um checklist, excluído por ${escaparAtributo(excluido.excluido?.usuario || '')}.
                <button type="button" onclick="restaurarProjetoDiario('${escaparAtributo(excluido.id)}')">Restaurar com os dias e fotos</button></div>` : ''}
            <div class="dp-campos">
                <label>Obra / loja <input type="text" name="obra" maxlength="200" value="${escaparAtributo([orcamento.cliente, orcamento.cidade].filter(Boolean).join(' – '))}"></label>
                <label>Responsável <input type="text" name="gerente" maxlength="150" placeholder="Opcional"></label>
                <label style="flex: 0 0 160px;">Início <input type="date" name="inicio" value="${dataServidor().toLocaleDateString('en-CA')}"></label>
            </div>
            ${blocoItensDiario()}`
        desenharItensDiario()
    } catch (e) { local.innerHTML = ''; popup({ mensagem: e.message }) }
}

const itemDoOrcamentoDiario = i => ({ id: i.id, marcado: false, descricao: i.descricao, unidade: i.unidade, previsto: i.qtde, inicial: 0,
    origem: `${i.codigo} · ${i.tipo || 'item'}`, executado: 0 })

const blocoItensDiario = () => `
    <div class="dp-barra" style="margin: 10px 0 6px;">
        <input type="text" placeholder="Filtrar itens…" oninput="desenharItensDiario(this.value)">
        ${montagemDiario.temServico ? `<button type="button" onclick="marcarItensDiario('servicos')">Só serviços</button>` : ''}
        <button type="button" onclick="marcarItensDiario('todos')">Todos</button>
        <button type="button" onclick="marcarItensDiario('nenhum')">Nenhum</button>
        <button type="button" onclick="novoItemDiario()">+ Item próprio</button>
        <b id="resumoItensDiario"></b>
    </div>
    <div class="dp-itens" id="itensDiario"></div>
    <small style="color:#66766d">Renomeie como o técnico entende (ex.: "Instalação de câmeras"), ajuste a quantidade e marque só o que deve ser acompanhado. O orçamento não muda.</small>`

// Só redesenha a lista; o que foi digitado já está em montagemDiario (editarItemDiario).
function desenharItensDiario(filtro = document.querySelector('.dp-barra input[type=text]')?.value || '') {
    const local = document.getElementById('itensDiario')
    if (!local || !montagemDiario) return
    const palavras = palavrasEscolha(filtro)
    const linhas = montagemDiario.itens.map((item, i) => ({ item, i }))
        .filter(({ item }) => palavras.every(p => normEscolha(`${item.descricao} ${item.origem}`).includes(p)))
    const campo = (i, nome, tipo, valor, extra = '') =>
        `<input type="${tipo}" value="${escaparAtributo(valor ?? '')}" ${extra} oninput="editarItemDiario(${i}, '${nome}', this.value)">`
    local.innerHTML = `<table>
        <thead><tr><th class="dp-marca"></th><th>Atividade no checklist</th><th class="dp-un">Unidade</th><th class="dp-num">Previsto</th><th class="dp-num">Já executado</th><th class="dp-ordem">Ordem</th></tr></thead>
        <tbody>${linhas.map(({ item, i }) => `
            <tr class="${item.marcado ? '' : 'dp-fora'}">
                <td class="dp-marca"><input type="checkbox" aria-label="Incluir" ${item.marcado ? 'checked' : ''} onchange="alternarItemDiario(${i}, this)"></td>
                <td>${campo(i, 'descricao', 'text', item.descricao, 'maxlength="200"')}<small>${escaparAtributo(item.origem)}${item.executado ? ` · executado nos dias: ${numeroPlanoDiario(item.executado)}` : ''}</small></td>
                <td class="dp-un">${campo(i, 'unidade', 'text', item.unidade, 'maxlength="20"')}</td>
                <td class="dp-num">${campo(i, 'previsto', 'number', item.previsto, 'min="0" step="any"')}</td>
                <td class="dp-num">${campo(i, 'inicial', 'number', item.inicial, 'min="0" step="any" title="Executado antes do primeiro dia deste checklist"')}</td>
                <td class="dp-ordem"><button type="button" aria-label="Subir" onclick="moverItemDiario(${i}, -1)">↑</button> <button type="button" aria-label="Descer" onclick="moverItemDiario(${i}, 1)">↓</button></td>
            </tr>`).join('') || '<tr><td colspan="6">Nenhum item.</td></tr>'}</tbody></table>`
    resumoItensDiario()
}

function resumoItensDiario() {
    const el = document.getElementById('resumoItensDiario')
    const n = montagemDiario.itens.filter(i => i.marcado).length
    if (el) el.textContent = `${n} de ${montagemDiario.itens.length} no checklist`
}

function editarItemDiario(i, campo, valor) {
    montagemDiario.itens[i][campo] = valor
}

function alternarItemDiario(i, caixa) {
    const item = montagemDiario.itens[i]
    if (!caixa.checked && item.executado > 0) {
        caixa.checked = true
        return popup({ mensagem: 'Este item já tem quantidade executada e não pode sair do checklist.' })
    }
    item.marcado = caixa.checked
    caixa.closest('tr').classList.toggle('dp-fora', !item.marcado)
    resumoItensDiario()
}

function marcarItensDiario(modo) {
    for (const item of montagemDiario.itens)
        item.marcado = item.executado > 0 || modo === 'todos' || (modo === 'servicos' && /· SERVIÇO$/.test(item.origem))
    desenharItensDiario()
}

function moverItemDiario(i, passo) {
    const { itens } = montagemDiario
    if (!itens[i + passo]) return
    ;[itens[i], itens[i + passo]] = [itens[i + passo], itens[i]]
    desenharItensDiario()
}

function novoItemDiario() {
    montagemDiario.itens.unshift({ id: `p${crypto.randomUUID()}`, marcado: true, descricao: '', unidade: 'Un.', previsto: 1, inicial: 0, origem: 'Item próprio', executado: 0 })
    const filtro = document.querySelector('.dp-barra input[type=text]')
    if (filtro) filtro.value = ''
    desenharItensDiario('')
    document.querySelector('#itensDiario td input[type=text]')?.focus()
}

const atividadesMontagemDiario = () => montagemDiario.itens.filter(i => i.marcado)
    .map(({ id, descricao, unidade, previsto, inicial }) => ({ id, descricao, unidade, previsto: Number(previsto), inicial: Number(inicial || 0) }))

async function salvarMontagemDiario() {
    if (!montagemDiario) return popup({ mensagem: 'Escolha o orçamento na lista.' })
    if (montagemDiario.salvando) return
    const m = montagemDiario
    const raiz = document.getElementById(m.popup)
    const valor = nome => raiz.querySelector(`input[name="${nome}"]`)?.value || ''
    m.salvando = true
    try {
        const atividades = atividadesMontagemDiario()
        const id = m.plano || (await apiPlanoDiario('criar', { orcamento: m.orcamento, obra: valor('obra'), gerente: valor('gerente'), inicio: valor('inicio'), atividades })).id
        if (m.plano) await apiPlanoDiario('atividades', { plano: m.plano, versao: m.versao, obra: valor('obra'), atividades })
        removerPopup(m.popup)
        montagemDiario = null
        await reabrirProjetoDiario(id)
        popup({ mensagem: m.plano ? 'Itens atualizados.' : 'Checklist criado.', imagem: 'imagens/concluido.png' })
    } catch (e) { popup({ mensagem: e.message }) }
    finally { m.salvando = false }
}

// Reabre mantendo o dia que estava na tela.
async function reabrirProjetoDiario(id) {
    const e = estadoPlanoDiario
    await carregarListaPlanosDiarios()
    const data = e.plano?.id === id ? e.data : null
    await abrirPlanoDiario(id)
    if (data && data !== e.data) await selecionarDataPlanoDiario(data)
}

async function editarItensDiario() {
    const e = estadoPlanoDiario
    if (e.alterado) return popup({ mensagem: 'Salve o dia antes de mexer nos itens.' })
    try {
        const { plano, atividades, executado, itens } = await apiPlanoDiario('itens', { plano: e.plano.id })
        const doOrcamento = new Map(itens.map(i => [i.id, i]))
        const dentro = new Set(atividades.map(a => a.id))
        montagemDiario = {
            plano: plano.id, versao: plano.versao, temServico: itens.some(i => i.tipo === 'SERVIÇO'),
            itens: [
                ...atividades.map(a => {
                    const orc = doOrcamento.get(a.id)
                    return { ...a, marcado: true, executado: executado[a.id] || 0,
                        origem: orc ? `${numeroPlanoDiario(orc.qtde)} no orçamento · ${orc.codigo} · ${orc.tipo || 'item'}` : a.id.startsWith('p') ? 'Item próprio' : 'Não está mais no orçamento' }
                }),
                ...itens.filter(i => !dentro.has(i.id)).map(itemDoOrcamentoDiario)
            ]
        }
        montagemDiario.popup = popup({
            titulo: `Itens · ${escaparAtributo(plano.titulo)}`,
            elemento: `<div class="dp-form"><div class="dp-campos">
                <label>Obra / loja <input type="text" name="obra" maxlength="200" value="${escaparAtributo(plano.obra)}"></label></div>${blocoItensDiario()}</div>`,
            botoes: [{ texto: 'Salvar itens', img: 'concluido', funcao: 'salvarMontagemDiario()' }]
        })
        desenharItensDiario('')
    } catch (err) { popup({ mensagem: err.message }) }
}

async function excluirProjetoDiario() {
    const e = estadoPlanoDiario
    if (!e.plano || e.carregando || e.renderizando) return
    const dias = e.dias.length, fotos = (e.plano.galeria || []).length
    if (!(await confirmarPopup({
        titulo: 'Excluir checklist', textoConfirmar: 'Excluir',
        mensagem: `Excluir o checklist <b>${escaparAtributo(e.plano.titulo)}</b>?<br>${dias} dia(s) e ${fotos} foto(s) saem da tela, mas ficam guardados: adicionar o mesmo orçamento permite restaurar.`
    }))) return
    try {
        await apiPlanoDiario('remover', { plano: e.plano.id })
        e.alterado = false
        await carregarListaPlanosDiarios()
        await abrirPlanoDiario('')
        popup({ mensagem: 'Checklist excluído.', imagem: 'imagens/concluido.png' })
    } catch (err) { popup({ mensagem: err.message }) }
}

async function restaurarProjetoDiario(id) {
    try {
        await apiPlanoDiario('restaurar', { plano: id })
        removerPopup(montagemDiario?.popup)
        montagemDiario = null
        await reabrirProjetoDiario(id)
        popup({ mensagem: 'Checklist restaurado.', imagem: 'imagens/concluido.png' })
    } catch (e) { popup({ mensagem: e.message }) }
}
