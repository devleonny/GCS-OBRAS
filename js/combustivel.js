let frotaCombustivel = []

function resumoDivergenciasCombustivel(conferencias, limiteKm = 20, limitePercentual = 10) {
    const relevantes = conferencias.filter(c => c.anterior_id &&
        c.situacao !== 'Conferir marcações no mesmo dia' && Number(c.km_rodados) >= 0)
    const grandes = relevantes.filter(c => Math.abs(Number(c.diferenca_km)) > limiteKm &&
        (Number(c.km_rodados) === 0 || Math.abs(Number(c.diferenca_km)) * 100 / Number(c.km_rodados) > limitePercentual))
    return { quantidade: grandes.length, km: grandes.reduce((s, c) => s + Math.abs(Number(c.diferenca_km)), 0) }
}

async function formularioOutroUsoCombustivel(veiculoId, id) {
    try {
        const uso = id ? await recuperarDado('combustivel_outros_usos', id) : {}
        if (id && (!uso?.id || uso.excluido)) throw new Error('Uso não encontrado.')
        controlesCxOpcoes.comb_uso_departamento = { base: 'mesc_departamentos', retornar: ['id'], colunas: { 'Departamento': { chave: 'id' } } }
        popupFormularioCombustivel({ titulo: id ? 'Editar outro uso' : 'Registrar outro uso', elemento: `
            <form data-id="${escaparAtributo(id || crypto.randomUUID())}" data-veiculo="${escaparAtributo(veiculoId)}" onsubmit="event.preventDefault(); salvarOutroUsoCombustivel(this)">
                <label>Data<input name="data_consumo" type="date" required value="${uso.data_consumo ? escaparAtributo(String(uso.data_consumo).slice(0, 10)) : dataServidor().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}"></label>
                <label>Tipo de uso<select name="categoria">${['Particular', 'Administrativo', 'Oficina', 'Outro'].map(c => `<option ${uso.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
                <label>km<input name="km" inputmode="decimal" required value="${escaparAtributo(uso.km ?? '')}"></label>
                <label>Motivo<textarea name="motivo" required minlength="10">${escaparAtributo(uso.motivo || '')}</textarea></label>
                <label>Departamento do custo<span name="comb_uso_departamento" class="opcoes" ${uso.departamento ? `id="${escaparAtributo(uso.departamento)}"` : ''} onclick="cxOpcoes('comb_uso_departamento')">${escaparAtributo(uso.departamento || 'Selecionar')}</span></label>
                <p role="status"></p><button type="submit">Salvar uso</button>
            </form>` })
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

async function salvarOutroUsoCombustivel(form) {
    return executarFormularioCombustivel(form, async () => {
        const valor = nome => form.elements.namedItem(nome).value.trim()
        const km = numeroCombustivel(valor('km'))
        const departamento = form.querySelector('[name="comb_uso_departamento"]').id
        if (km <= 0 || !departamento || valor('motivo').length < 10)
            throw new Error('Informe km positivo, departamento e motivo com pelo menos 10 caracteres.')
        if (!valor('data_consumo') || valor('data_consumo') > dataServidor().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
            throw new Error('Informe uma data válida, sem ser futura.')
        const resposta = await enviar(`combustivel_outros_usos/${form.dataset.id}`, {
            id: form.dataset.id, veiculo_id: form.dataset.veiculo, km, departamento,
            data_consumo: valor('data_consumo'), categoria: valor('categoria'),
            motorista: '', motivo: valor('motivo'), usuario: acesso.usuario
        })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Falha ao registrar outro uso.')
        const movimentos = document.querySelector('.combustivel-movimentos')?.closest('.popup')
        if (movimentos) removerPopup(movimentos.id)
    })
}

function formatarDataHistoricoCombustivel(valor) {
    if (!valor) return '—'
    const texto = String(valor)
    const data = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
    if (data) return `${data[3]}/${data[2]}/${data[1]}`
    const instante = new Date(texto)
    return Number.isNaN(instante.getTime()) ? '—'
        : instante.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function horarioCombustivel(data, hora) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora))
        throw new Error('Informe a data e a hora da marcação ou do percurso.')
    const instante = new Date(`${data}T${hora}:00-03:00`)
    if (!Number.isFinite(instante.getTime())) throw new Error('Data ou hora inválida.')
    return instante.toISOString()
}

function ajudaConferenciaHodometro() {
    popup({ titulo: 'Conferência do hodômetro', mensagem: 'Diferença = km rodados menos km dos chamados e dos outros usos registrados.<br><br>O primeiro registro é a referência inicial.<br><br>A soma considera os dias após a marcação anterior até o dia da atual, inclusive. Sem horários, os limites do intervalo são aproximados.<br><br>O alerta principal destaca diferenças maiores que 20 km e 10% do intervalo, incluindo diferenças negativas. Justificar não elimina a divergência.<br><br>Revise os chamados ou registre uso particular, administrativo, oficina ou outro. Percursos nos dias dos abastecimentos precisam ser conferidos.' })
}

function criarLinhaConferenciaHodometro(c) {
    const e = escaparAtributo, n = formatarCombustivel
    const foto = /^https:\/\//i.test(c.foto_hodometro || '')
        ? `<a href="${e(c.foto_hodometro)}" target="_blank" rel="noopener noreferrer">Ver foto</a>` : ''
    return `<tr><td>${e(formatarDataHistoricoCombustivel(c.marcado_em))}</td>
        <td>${n(c.hodometro)} km</td><td>${c.anterior_id ? n(c.km_rodados) : '—'}</td>
        <td>${c.anterior_id ? n(c.km_so_chamados ?? c.km_chamados) : '—'}${Number(c.km_outros_usos) ? `<br><small>Outros usos: ${n(c.km_outros_usos)} km</small>` : ''}</td><td>${c.anterior_id ? n(c.diferenca_km) : '—'}</td>
        <td>${e(c.situacao)}${Number(c.percursos_sem_horario) ? `<br>${n(c.percursos_sem_horario)} percurso(s) sem horário` : ''}</td>
        <td>${foto}<p>${e(c.justificativa_hodometro?.texto || '')}</p>
        ${c.situacao === 'Pendente de justificativa' ? `<button type="button" data-id="${e(c.id)}" onclick="formularioJustificativaHodometro(this.dataset.id)">Justificar diferença</button>` : ''}</td></tr>`
}

async function formularioJustificativaHodometro(id) {
    try {
        const c = await recuperarDado('vw_combustivel_conferencia', id)
        if (!c || c.situacao !== 'Pendente de justificativa') throw new Error('Atualize os movimentos para conferir a situação atual.')
        const resumo = { anterior_id: c.anterior_id, km_rodados: c.km_rodados, km_chamados: c.km_chamados }
        popupFormularioCombustivel({ titulo: 'Justificar diferença de quilômetros', elemento: `
            <form data-id="${escaparAtributo(id)}" data-veiculo="${escaparAtributo(c.veiculo_id)}"
                data-resumo="${escaparAtributo(JSON.stringify(resumo))}" onsubmit="event.preventDefault(); salvarJustificativaHodometro(this)">
                <p>Rodados: ${formatarCombustivel(c.km_rodados)} km. Chamados: ${formatarCombustivel(c.km_chamados)} km. Diferença: ${formatarCombustivel(c.diferenca_km)} km.</p>
                <label>Justificativa<textarea name="justificativa" required minlength="10"></textarea></label>
                <p role="status"></p><button type="submit">Salvar justificativa</button>
            </form>` })
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

async function salvarJustificativaHodometro(form) {
    const botao = form.querySelector('[type="submit"]')
    if (botao.disabled) return
    botao.disabled = true
    try {
        const texto = form.elements.justificativa.value.trim()
        if (texto.length < 10) throw new Error('Descreva a justificativa com pelo menos 10 caracteres.')
        const justificativa = { ...JSON.parse(form.dataset.resumo), texto, usuario: acesso.usuario, registrado_em: dataServidor().toISOString() }
        const resposta = await enviar(`combustivel_abastecimentos/${form.dataset.id}/justificativa_hodometro`, justificativa)
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar a justificativa.')
        removerPopup(form.closest('.popup').id)
        const controle = controles.conferenciaHodometro
        controle.base = await consultarCombustivel('vw_combustivel_conferencia_usos', { veiculo_id: { op: '=', value: form.dataset.veiculo } })
        controle.priBase = null
        await paginacao('conferenciaHodometro')
    } catch (erro) { form.querySelector('[role="status"]').textContent = erro.message }
    finally { botao.disabled = false }
}

function numeroCombustivel(valor) {
    const texto = String(valor ?? '').trim().replace(',', '.')
    if (!/^\d+(?:\.\d{1,3})?$/.test(texto)) throw new Error('Informe um número positivo, com até três casas decimais.')
    const numero = Number(texto)
    if (!Number.isFinite(numero)) throw new Error('Número inválido.')
    return numero
}

function formatarCombustivel(valor, casas = 2) {
    return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

async function consultarCombustivel(base, filtros = {}) {
    const itens = []
    let pagina = 1, paginas = 1
    do {
        const resposta = await pesquisarDB({ base, filtros, pagina, ordenar: { path: 'id', direcao: 'ASC' } })
        itens.push(...(resposta.resultados || []))
        paginas = Number(resposta.paginas) || 1
        pagina++
    } while (pagina <= paginas)
    return itens
}

async function telaCombustivel() {
    overlayAguarde()
    try {
        const [saldos, opcoes, conferencias] = await Promise.all([
            consultarCombustivel('vw_combustivel_saldos'), consultarCombustivel('vw_veiculos_opcoes'),
            consultarCombustivel('vw_combustivel_conferencia_usos')
        ])
        const motoristas = new Map(opcoes.map(v => [String(v.id), v.motoristas_nomes]))
        frotaCombustivel = saldos.map(v => ({ ...v,
            divergencia: resumoDivergenciasCombustivel(conferencias.filter(c => String(c.veiculo_id) === String(v.id))),
            motoristas_nomes: motoristas.get(String(v.id)) || '',
            sem_registro_combustivel: Number(v.saldo_inicial) > 0 || Number(v.litros_abastecidos) > 0 || Number(v.litros_consumidos) > 0 ? 0 : 1
        }))
        const tabelaTanque = await modTab({ pag: 'tanquesCombustivel', body: 'bodyTanqueCombustivel', base: frotaCombustivel,
            ordenar: [
                { path: 'sem_registro_combustivel', direcao: 'ASC' },
                { path: 'percentual', direcao: 'ASC' }
            ], criarLinha: 'criarLinhaTanqueCombustivel', colunas: {
            'Veículo': { chave: 'placa' },
            'Motoristas': { chave: 'motoristas_nomes' },
            'Combustível': { chave: 'combustivel' },
            'Tanque estimado': { chave: 'percentual' },
            'Consumo médio': { chave: 'consumo_medio' },
            'Consumido': { chave: 'litros_consumidos' },
            'Conferência de km': { chave: 'divergencia.km' },
            'Ações': {}
        } })
        tela.innerHTML = `<div class="pagina-conteudo">
            <div class="cabecalho-pagina"><h2>Combustível</h2></div>
            ${tabelaTanque}
        </div>`
        await paginacao('tanquesCombustivel')
    } catch (erro) {
        popup({ mensagem: escaparAtributo(erro.message || 'Falha ao carregar combustível. Execute o SQL de instalação primeiro.') })
    } finally { removerOverlay() }
}

function popupFormularioCombustivel({ titulo, elemento }) {
    const modelo = document.createElement('template')
    modelo.innerHTML = elemento.trim()
    const form = modelo.content.querySelector('form')
    const botaoSalvar = form.querySelector('[type="submit"]')
    const idForm = `form-combustivel-${crypto.randomUUID()}`
    const linhas = [...form.children].filter(filho => filho !== botaoSalvar).map(filho => {
        if (filho.hasAttribute('data-campo-motoristas')) return {
            texto: filho.querySelector('[data-titulo-motoristas]').outerHTML,
            elemento: filho.querySelector('[data-motoristas-combustivel]').outerHTML
        }
        if (filho.tagName !== 'LABEL') return { elemento: filho.outerHTML }
        const texto = filho.firstChild?.nodeType === 3 ? filho.firstChild.textContent.trim() : ''
        if (texto) filho.firstChild.remove()
        return { texto, elemento: filho.innerHTML, overlay: filho.hasAttribute('data-overlay') }
    })
    const idPopup = popup({
        titulo,
        linhas,
        botoes: [{ id: `${idForm}-salvar`, texto: botaoSalvar.textContent, img: 'concluido', funcao: `document.getElementById('${idForm}').requestSubmit()` }]
    })
    const painel = document.getElementById(idPopup).querySelector('.painel-padrao')
    form.replaceChildren()
    form.id = idForm
    form.botaoSalvarVisivel = document.getElementById(`${idForm}-salvar`)
    form.className = 'combustivel-modal-form'
    painel.replaceWith(form)
    form.appendChild(painel)
    // Mantém o controle de envio duplicado e o envio por Enter no formulário.
    botaoSalvar.hidden = true
    form.appendChild(botaoSalvar)
    return idPopup
}

function linhaMotoristaCombustivel(motorista = {}) {
    const nomeCampo = `comb-motorista-${crypto.randomUUID()}`
    controlesCxOpcoes[nomeCampo] = {
        base: 'clientes', retornar: ['nome'],
        filtros: { usuario: { op: 'NOT_EMPTY' } },
        colunas: { 'Nome': { chave: 'nome' }, 'Usuário': { chave: 'usuario' }, 'Cidade': { chave: 'cidade' } }
    }
    return `<div class="combustivel-motorista" data-motorista-combustivel>
        <button type="button" class="combustivel-controle-motorista" title="Remover motorista" aria-label="Remover motorista" onclick="removerMotoristaCombustivel(this)"><img src="imagens/cancel.png" alt=""></button>
        <span class="opcoes" name="${nomeCampo}" ${motorista.id != null ? `id="${escaparAtributo(motorista.id)}"` : ''}
            onclick="cxOpcoes('${nomeCampo}')">${escaparAtributo(motorista.nome || 'Selecionar motorista')}</span>
    </div>`
}

function adicionarMotoristaCombustivel(botao) {
    botao.closest('form').querySelector('[data-motoristas-combustivel]').insertAdjacentHTML('beforeend', linhaMotoristaCombustivel())
}

function removerMotoristaCombustivel(botao) {
    const linha = botao.closest('[data-motorista-combustivel]')
    delete controlesCxOpcoes[linha.querySelector('span').getAttribute('name')]
    linha.remove()
}

function lerMotoristasCombustivel(form) {
    const ids = new Set()
    for (const campo of form.querySelectorAll('[data-motorista-combustivel] span')) {
        if (!campo.id) throw new Error('Selecione o motorista ou remova a linha em branco.')
        ids.add(campo.id)
    }
    return [...ids].map(id => ({ id: /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : id }))
}

async function formularioVeiculoCombustivel(id) {
    try {
        const v = id ? await recuperarDado('veiculos', id) : {}
        if (id && !v) throw new Error('Veículo não encontrado.')
        const idsMotoristas = [...new Set((v.motoristas || []).map(m => String(m.id)).filter(id => id !== 'undefined'))]
        const motoristas = await Promise.all(idsMotoristas.map(async id => {
            const cliente = await recuperarDado('clientes', id)
            return linhaMotoristaCombustivel({ id, nome: cliente?.nome || `Motorista ${id}` })
        }))
        const campo = (nome, texto, valor = '', tipo = 'text') => `<label>${texto}<input name="${nome}" type="${tipo}" value="${escaparAtributo(valor ?? '')}"></label>`
        popupFormularioCombustivel({ titulo: id ? 'Editar veículo' : 'Cadastrar veículo', elemento: `
            <form class="combustivel-form" data-id="${escaparAtributo(id || crypto.randomUUID())}" onsubmit="event.preventDefault(); salvarVeiculoCombustivel(this)">
                ${campo('placa', 'Placa', v.placa)}${campo('modelo', 'Marca e modelo', v.modelo)}
                ${campo('ano', 'Ano', v.ano, 'number')}
                <div data-campo-motoristas>
                    <div class="combustivel-titulo-motoristas" data-titulo-motoristas>
                        <button type="button" class="combustivel-controle-motorista" title="Adicionar motorista" aria-label="Adicionar motorista" onclick="adicionarMotoristaCombustivel(this)"><img src="imagens/baixar.png" alt=""></button>
                        <span>Motoristas vinculados</span>
                    </div>
                    <div data-motoristas-combustivel>${motoristas.join('')}</div>
                </div>
                <label>Combustível<select name="combustivel">${['Gasolina', 'Etanol', 'Diesel', 'Flex'].map(op => `<option ${v.combustivel === op ? 'selected' : ''}>${op}</option>`).join('')}</select></label>
                ${campo('capacidade_tanque', 'Capacidade do tanque (L)', v.capacidade_tanque)}
                ${campo('consumo_medio', 'Consumo médio (km/l)', v.consumo_medio)}
                ${campo('saldo_inicial', 'Litros existentes ao iniciar o controle', v.saldo_inicial || 0)}
                <small>O saldo inicial só pode ser alterado antes das movimentações. Mudanças de km/l valem para novos consumos.</small>
                <label><input name="ativo" type="checkbox" ${v.ativo !== false ? 'checked' : ''}> Veículo ativo</label>
                <p role="status"></p><button type="submit">Salvar veículo</button>
            </form>` })
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

function estadoEnvioCombustivel(form, salvando) {
    form.setAttribute?.('aria-busy', String(salvando))
    if (salvando) overlayAguarde()
    else removerOverlay()
}

async function executarFormularioCombustivel(form, tarefa) {
    const botao = form.querySelector('[type="submit"]')
    if (botao.disabled) return
    botao.disabled = true
    estadoEnvioCombustivel(form, true)
    try {
        await tarefa()
        removerPopup(form.closest('.popup').id)
        await telaCombustivel()
    } catch (erro) { form.querySelector('[role="status"]').textContent = erro.message }
    finally { botao.disabled = false; estadoEnvioCombustivel(form, false) }
}

async function salvarVeiculoCombustivel(form) {
    return executarFormularioCombustivel(form, async () => {
        const valor = nome => form.elements.namedItem(nome).value.trim()
        const capacidade_tanque = numeroCombustivel(valor('capacidade_tanque'))
        const consumo_medio = numeroCombustivel(valor('consumo_medio'))
        const saldo_inicial = numeroCombustivel(valor('saldo_inicial'))
        if (!valor('placa') || !valor('modelo')) throw new Error('Informe placa e modelo.')
        if (capacidade_tanque <= 0 || consumo_medio <= 0 || saldo_inicial > capacidade_tanque)
            throw new Error('Informe tanque e km/l positivos e saldo inicial até a capacidade do tanque.')
        const anterior = await recuperarDado('veiculos', form.dataset.id) || {}
        const motoristas = lerMotoristasCombustivel(form)
        const resposta = await enviar(`veiculos/${form.dataset.id}`, { ...anterior, id: form.dataset.id,
            placa: valor('placa').toUpperCase().replace(/[^A-Z0-9]/g, ''), modelo: valor('modelo'),
            ano: valor('ano') ? Number(valor('ano')) : null, combustivel: valor('combustivel'),
            capacidade_tanque, consumo_medio, saldo_inicial, motoristas, ativo: form.elements.ativo.checked })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar o veículo.')
    })
}

function formularioAbastecimento(veiculoId) {
    for (const [nome, base, rotulo] of [
        ['comb_fornecedor', 'clientes', 'nome'], ['comb_categoria', 'mesc_categorias', 'id'], ['comb_transitorio', 'mesc_departamentos', 'id']
    ]) controlesCxOpcoes[nome] = { base, retornar: [rotulo], colunas: { 'Cadastro': { chave: rotulo } } }
    const opcao = (nome, texto, id, descricao = id) => `<label data-overlay>${texto}<span name="${nome}" id="${escaparAtributo(id)}" class="opcoes" onclick="cxOpcoes('${nome}')">${escaparAtributo(descricao)}</span></label>`
    popupFormularioCombustivel({ titulo: 'Registrar abastecimento', elemento: `
        <form class="combustivel-form" data-veiculo="${escaparAtributo(veiculoId)}" data-id="${crypto.randomUUID()}" data-pagamento="${crypto.randomUUID()}"
            onsubmit="event.preventDefault(); salvarAbastecimento(this)">
            <label>Data do abastecimento<input name="data_abastecimento" type="date" required value="${dataServidor().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}"></label>
            <label>Hodômetro (km)<input name="hodometro" type="number" min="0" step="0.001" required></label>
            <label>Foto do hodômetro<input name="foto_hodometro" type="file" accept="image/*" capture="environment" required></label>
            <label>Litros abastecidos<input name="litros" inputmode="decimal" placeholder="Ex.: 20,5" required></label>
            <label>Valor total (R$)<input name="valor_total" inputmode="decimal" required></label>
            <label>Observação<textarea name="observacao"></textarea></label>
            <label>Empresa do pagamento<select name="app">${empresas.filter(a => ['AC', 'IAC', 'HNK'].includes(a)).map(a => `<option>${escaparAtributo(a)}</option>`).join('')}</select></label>
            ${opcao('comb_fornecedor', 'Fornecedor', '6066446384', 'TICKET LOG')}${opcao('comb_categoria', 'Categoria do pagamento', 'Combustível')}
            ${opcao('comb_transitorio', 'Centro de custo transitório', 'COMBUSTÍVEL NÃO ALOCADO')}
            <p role="status"></p><button type="submit">Salvar abastecimento</button>
        </form>` })
}

async function salvarAbastecimento(form) {
    return executarFormularioCombustivel(form, async () => {
        const valor = nome => form.elements.namedItem(nome).value.trim()
        const litros = numeroCombustivel(valor('litros')), valor_total = numeroCombustivel(valor('valor_total'))
        if (litros <= 0 || valor_total <= 0 || Math.abs(valor_total * 100 - Math.round(valor_total * 100)) > 1e-7)
            throw new Error('Informe litros positivos e valor com até duas casas decimais.')
        const referencia = nome => form.querySelector(`[name="${nome}"]`).id
        const fornecedor = referencia('comb_fornecedor'), categoria = referencia('comb_categoria'), transitorio = referencia('comb_transitorio')
        if (!fornecedor || !categoria || !transitorio) throw new Error('Selecione fornecedor, categoria e centro de custo transitório.')
        const hodometro = numeroCombustivel(valor('hodometro'))
        const marcado_em = horarioCombustivel(valor('data_abastecimento'), '00:00')
        if (new Date(marcado_em) > dataServidor()) throw new Error('A marcação não pode ser futura.')
        const inputFoto = form.elements.namedItem('foto_hodometro')
        if (!inputFoto.files?.[0]?.type.startsWith('image/')) throw new Error('Selecione uma foto do hodômetro.')
        if (!form.fotoHodometro || form.arquivoHodometro !== inputFoto.files[0]) {
            const fotos = await importarAnexos({ input: inputFoto })
            if (!fotos?.[0]?.link) throw new Error('Não foi possível enviar a foto do hodômetro.')
            form.fotoHodometro = fotos[0].link
            form.arquivoHodometro = inputFoto.files[0]
        }
        const resposta = await enviar(`combustivel_abastecimentos/${form.dataset.id}`, {
            id: form.dataset.id, veiculo_id: form.dataset.veiculo, data_abastecimento: valor('data_abastecimento'),
            litros, valor_total, observacao: valor('observacao'),
            hodometro, marcado_em, foto_hodometro: form.fotoHodometro,
            pagamento_id: form.dataset.pagamento, usuario: acesso.usuario,
            pagamento_config: { fornecedor, categoria, transitorio, app: valor('app') }
        })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar o abastecimento.')
    })
}

async function detalhesCombustivel(id) {
    overlayAguarde()
    try {
        const filtro = { veiculo_id: { op: '=', value: id } }
        const [abastecimentos, consumos, rateios, conferencias, pagamentosOmie, outrosUsos] = await Promise.all([
            consultarCombustivel('combustivel_abastecimentos', { ...filtro, excluido: { op: 'IS_EMPTY' } }),
            consultarCombustivel('combustivel_consumos', filtro), consultarCombustivel('vw_combustivel_rateios', filtro),
            consultarCombustivel('vw_combustivel_conferencia_usos', filtro),
            consultarCombustivel('vw_combustivel_pagamentos', filtro),
            consultarCombustivel('combustivel_outros_usos', { ...filtro, excluido: { op: 'IS_EMPTY' } })
        ])
        const e = escaparAtributo, n = formatarCombustivel
        const veiculo = frotaCombustivel.find(v => String(v.id) === id)
        const totalConsumido = consumos.reduce((soma, c) => soma + Number(c.litros), 0)
        const semOrigem = Math.max(0, totalConsumido - Math.min(totalConsumido, Number(veiculo?.saldo_inicial || 0))
            - rateios.reduce((soma, r) => soma + Number(r.litros_distribuidos), 0))
        const tabelaAbastecimento = await modTab({ pag: 'abastecimentosCombustivel', body: 'bodyAbastecimentoCombustivel', base: abastecimentos.map(a => ({ ...a, rateio: rateios.find(r => r.id === a.id), sincronizacao: pagamentosOmie.find(p => p.id === a.id) })), criarLinha: 'criarLinhaAbastecimentoCombustivel', scroll: false, colunas: {
            'Data': { chave: 'data_abastecimento' , tipoPesquisa: 'data' },
            'Litros': { chave: 'litros' },
            'Valor total': { chave: 'valor_total' },
            'Observação': { chave: 'observacao' },
            'Sem departamento': { chave: 'rateio.litros_pendentes' },
            'Rateio por departamento': {},
            'Pagamento / Omie': { chave: 'sincronizacao.situacao' }
        } })
        const tabelaConsumo = await modTab({ pag: 'consumosCombustivel', body: 'bodyConsumoCombustivel', base: consumos.filter(c => !String(c.id).startsWith('outro-uso:')), criarLinha: 'criarLinhaConsumoCombustivel', scroll: false, colunas: {
            'Data': { chave: 'data_consumo' , tipoPesquisa: 'data' },
            'Distância': { chave: 'km' },
            'Litros': { chave: 'litros' },
            'Departamento': { chave: 'departamento' },
            'Motorista': { chave: 'motorista' },
            'Consumo médio': { chave: 'consumo_medio' },
            'Ocorrência': { chave: 'ocorrencia_id' }
        } })
        const tabelaConferencia = await modTab({ pag: 'conferenciaHodometro', body: 'bodyConferenciaHodometro',
            base: conferencias, criarLinha: 'criarLinhaConferenciaHodometro', scroll: false,
            ordenar: { path: 'marcado_em', direcao: 'DESC' }, colunas: {
                'Marcação': { chave: 'marcado_em' }, 'Hodômetro': { chave: 'hodometro' },
                'Km rodados': { chave: 'km_rodados' }, 'Km nos chamados': { chave: 'km_chamados' },
                'Diferença': { chave: 'diferenca_km' }, 'Situação': { chave: 'situacao' }, 'Evidência / Justificativa': {}
            } })
        popup({ titulo: 'Movimentos de combustível', elemento: `<div class="combustivel-movimentos">
            ${semOrigem > 0.001 ? `<p class="combustivel-alerta">${n(semOrigem)} L consumidos sem abastecimento anterior compatível. Confira datas e saldo inicial antes de distribuir custos.</p>` : ''}
            <h3>Abastecimentos</h3>
            ${tabelaAbastecimento}
            <h3>Conferência do hodômetro <button type="button" class="combustivel-ajuda" onclick="ajudaConferenciaHodometro()" title="Sobre a conferência do hodômetro" aria-label="Sobre a conferência do hodômetro">?</button></h3>
            ${tabelaConferencia}
            <h3>Outros usos <button type="button" data-id="${e(id)}" onclick="formularioOutroUsoCombustivel(this.dataset.id)">Registrar</button></h3>
            <div class="combustivel-outros-usos">${outrosUsos.map(u => `<div class="combustivel-uso"><strong>${e(u.categoria)} · ${n(u.km)} km</strong><span>${e(formatarDataHistoricoCombustivel(u.data_consumo))} · ${e(u.motorista)} · ${e(u.departamento)}</span><span>${e(u.motivo)}</span><small>Registrado por ${e(u.usuario)}</small><button type="button" data-veiculo="${e(id)}" data-id="${e(u.id)}" onclick="formularioOutroUsoCombustivel(this.dataset.veiculo, this.dataset.id)">Editar</button></div>`).join('') || '<p>Nenhum outro uso registrado.</p>'}</div>
            <h3>Consumos nas correções</h3>
            ${tabelaConsumo}
        </div>` })
        await paginacao('abastecimentosCombustivel')
        await paginacao('consumosCombustivel')
        await paginacao('conferenciaHodometro')
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
    finally { removerOverlay() }
}

async function prepararPagamentoAbastecimento(id) {
    try {
        const a = await recuperarDado('combustivel_abastecimentos', id)
        if (!a) throw new Error('Abastecimento não encontrado.')
        const existente = await recuperarDado('lista_pagamentos', a.pagamento_id)
        if (existente?.id) return abrirDetalhesPagamentos(a.pagamento_id)
        const estado = await recuperarDado('vw_combustivel_pagamentos', a.id)
        popup({ mensagem: escaparAtributo(estado?.erro || estado?.situacao ||
            'Pagamento em processamento. Reabra os movimentos para conferir a sincronização.') })
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

async function camposCombustivelCorrecao(correcao) {
    const atual = correcao.combustivel || {}
    controlesCxOpcoes.comb_veiculo = {
        base: 'vw_veiculos_opcoes',
        filtros: {
            ativo: { op: '=', value: true },
            consumo_medio: { op: '>', value: 0 },
            capacidade_tanque: { op: '>', value: 0 }
        },
        retornar: ['placa', 'modelo', 'motoristas_nomes'],
        colunas: {
            'Placa': { chave: 'placa' },
            'Modelo': { chave: 'modelo' },
            'Motoristas': { chave: 'motoristas_nomes' },
            'km/l': { chave: 'consumo_medio' }
        }
    }
    const selecionado = atual.veiculo_id ? await recuperarDado('vw_veiculos_opcoes', atual.veiculo_id) : null
    const descricaoVeiculo = selecionado
        ? [selecionado.placa, selecionado.modelo, selecionado.motoristas_nomes].filter(Boolean).join(' · ')
        : atual.veiculo_id || 'Selecionar veículo'
    return `<div class="combustivel-form" data-combustivel-correcao>
        <label>Veículo utilizado<span name="comb_veiculo" class="opcoes" ${atual.veiculo_id ? `id="${escaparAtributo(atual.veiculo_id)}"` : ''}
            onclick="cxOpcoes('comb_veiculo')">${escaparAtributo(descricaoVeiculo)}</span></label>
        <label>km<input name="comb_km" inputmode="decimal" value="${escaparAtributo(atual.km || '')}" placeholder="Ex.: 65,5"></label>
    </div>`
}

function lerCombustivelCorrecao(idChamado) {
    const areaTecnicos = document.querySelector('.tecnicos[data-combustivel-correcao]')
    if (areaTecnicos) {
        if (!idChamado) throw new Error('Chamado do percurso não identificado.')
        if (areaTecnicos.dataset.combustivelCarregando === 'true') throw new Error('Aguarde a consulta dos veículos dos técnicos.')
        if (areaTecnicos.dataset.combustivelErro) throw new Error(areaTecnicos.dataset.combustivelErro)
        const percursos = []
        for (const bloco of areaTecnicos.querySelectorAll('[data-percurso-tecnico]')) {
            const texto = bloco.querySelector('[name="km_tecnico"]').value.trim()
            if (!texto) continue
            const km = numeroCombustivel(texto)
            if (km <= 0) throw new Error('Informe quilômetros positivos ou deixe o campo vazio para não consumir.')
            const veiculo_id = bloco.querySelector('[name="veiculo_tecnico"]').value
            if (!veiculo_id) throw new Error(`Selecione o veículo de ${bloco.dataset.percursoTecnico}.`)
            const percurso_em = bloco.dataset.percursoEm || null
            if (percursos.some(p => p.tecnico === bloco.dataset.percursoTecnico)) throw new Error('O técnico está repetido. Registre seu percurso em uma única linha.')
            percursos.push({ tecnico: bloco.dataset.percursoTecnico, motorista: bloco.dataset.percursoTecnico,
                veiculo_id, km, percurso_em, departamento: String(idChamado) })
        }
        return { versao: 2, percursos }
    }
    const bloco = document.querySelector('[data-combustivel-correcao]')
    if (!bloco) return undefined
    const veiculo_id = bloco.querySelector('[name="comb_veiculo"]').id
    const kmTexto = bloco.querySelector('[name="comb_km"]').value.trim()
    if (!veiculo_id && !kmTexto) return null
    if (!veiculo_id) throw new Error('Selecione o veículo do percurso.')
    const km = numeroCombustivel(kmTexto)
    if (km <= 0) throw new Error('Informe os quilômetros percorridos.')
    const departamento = String(idChamado || '')
    if (!departamento) throw new Error('Chamado do percurso não identificado.')
    return { veiculo_id, km, departamento, motorista: '' }
}

async function atualizarKmTecnicosCorrecao() {
    const area = document.querySelector('.tecnicos[data-combustivel-correcao]')
    if (!area) return
    const versao = (area.combustivelConsulta || 0) + 1
    area.combustivelConsulta = versao
    const campos = [...area.querySelectorAll('[data-usuario-selecao]')].filter(c => c.id)
    if (!campos.length) {
        area.dataset.combustivelCarregando = 'false'
        delete area.dataset.combustivelErro
        return
    }
    area.dataset.combustivelCarregando = 'true'
    try {
        area.combustivelVeiculos ??= Promise.all([
            consultarCombustivel('vw_veiculos_opcoes'), consultarCombustivel('veiculos')
        ]).then(([opcoes, cadastros]) => {
            const porId = new Map(cadastros.map(v => [String(v.id), v]))
            return opcoes.map(v => ({ ...porId.get(String(v.id)), ...v,
                motoristas: porId.get(String(v.id))?.motoristas || [] }))
        })
        const veiculos = await area.combustivelVeiculos
        if (!area.isConnected || versao !== area.combustivelConsulta) return
        delete area.dataset.combustivelErro
        const original = area.combustivelOriginal || {}
        for (const campo of campos) {
            const tecnico = campo.textContent.trim()
            const linha = campo.closest('[data-linha-usuario]')
            const anterior = linha.querySelector('[data-percurso-tecnico]')
            if (anterior?.dataset.percursoTecnico === tecnico) continue
            anterior?.remove()
            const salvo = Array.isArray(original.percursos) ? original.percursos.find(p => p.tecnico === tecnico)
                : original.veiculo_id && campo === campos[0] ? original : null
            const normalizar = valor => String(valor ?? '').trim().toLocaleLowerCase('pt-BR')
            const carros = veiculos.filter(v => (v.ativo && Number(v.consumo_medio) > 0 && (
                (v.motoristas_ids || []).map(String).includes(String(campo.id)) ||
                (v.motoristas || []).some(m => String(m?.id ?? m) === String(campo.id)) ||
                (v.motoristas_usuarios || []).some(usuario => normalizar(usuario) === normalizar(tecnico)))) ||
                (salvo && String(v.id) === String(salvo.veiculo_id)))
            if (!carros.length) continue
            const selecionado = salvo?.veiculo_id || (carros.length === 1 ? String(carros[0].id) : '')
            linha.insertAdjacentHTML('beforeend', `<div class="combustivel-percurso-tecnico" data-percurso-tecnico="${escaparAtributo(tecnico)}" data-percurso-em="${escaparAtributo(salvo?.percurso_em || '')}">
                <label>Veículo<select name="veiculo_tecnico">${carros.length > 1 ? '<option value="">Selecionar veículo</option>' : ''}
                    ${carros.map(v => `<option value="${escaparAtributo(v.id)}" ${String(v.id) === selecionado ? 'selected' : ''}>${escaparAtributo(v.placa || '')} · ${escaparAtributo(v.modelo || '')}</option>`).join('')}</select></label>
                <label>km<input name="km_tecnico" inputmode="decimal" placeholder="Ex.: 65,5" value="${escaparAtributo(salvo?.km ?? '')}"></label>
            </div>`)
        }
    } catch (erro) {
        if (!area.isConnected || versao !== area.combustivelConsulta) return
        area.combustivelVeiculos = null
        area.dataset.combustivelErro = 'Não foi possível consultar os veículos dos técnicos. Selecione o técnico novamente para tentar de novo.'
        popup({ mensagem: escaparAtributo(area.dataset.combustivelErro) })
    } finally {
        if (versao === area.combustivelConsulta) area.dataset.combustivelCarregando = 'false'
    }
}

function botaoAcaoCombustivel(acao, id) {
    const acoes = {
        editar: { titulo: 'Editar veículo', funcao: 'formularioVeiculoCombustivel', desenho: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>' },
        movimentos: { titulo: 'Ver movimentos', funcao: 'detalhesCombustivel', desenho: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>' },
        abastecer: { titulo: 'Registrar abastecimento', funcao: 'formularioAbastecimento', desenho: '<path d="M3 21h12M5 21V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v17M5 10h8m0 3h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9l-4-4"/><path d="M18 6v4h3"/>' },
        prepararPagamento: { titulo: 'Consultar sincronização do pagamento', funcao: 'prepararPagamentoAbastecimento', desenho: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-5 3v4m-2-2h4M6 15h3"/>' },
        abrirPagamento: { titulo: 'Abrir pagamento', funcao: 'prepararPagamentoAbastecimento', desenho: '<path d="M14 3h7v7m0-7-9 9"/><path d="M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>' }
    }
    const item = acoes[acao]
    return `<button type="button" class="combustivel-botao-icone" data-id="${escaparAtributo(id)}" title="${item.titulo}" aria-label="${item.titulo}" onclick="${item.funcao}(this.dataset.id)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${item.desenho}</svg></button>`
}

function menuAcoesVeiculoCombustivel(id) {
    const v = frotaCombustivel.find(item => String(item.id) === String(id))
    if (!v) return
    const acoes = [['editar', 'Editar veículo'], ['movimentos', 'Ver movimentos']]
    if (v.ativo && Number(v.capacidade_tanque) > 0 && Number(v.consumo_medio) > 0)
        acoes.push(['abastecer', 'Registrar abastecimento'], ['outros', 'Registrar outros usos'])
    popup({ titulo: v.placa || 'Ações do veículo', elemento: `<div class="combustivel-menu-acoes">${acoes.map(([acao, texto]) => `<button type="button" data-id="${escaparAtributo(id)}" data-acao="${acao}" onclick="executarAcaoVeiculoCombustivel(this)">${texto}</button>`).join('')}</div>` })
}

function executarAcaoVeiculoCombustivel(botao) {
    const funcoes = { editar: formularioVeiculoCombustivel, movimentos: detalhesCombustivel,
        abastecer: formularioAbastecimento, outros: formularioOutroUsoCombustivel }
    const funcao = funcoes[botao.dataset.acao]
    if (!funcao) return
    removerPopup(botao.closest('.popup').id)
    return funcao(botao.dataset.id)
}

function criarLinhaTanqueCombustivel(v) {
    const e = escaparAtributo
    const configurado = Number(v.capacidade_tanque) > 0 && Number(v.consumo_medio) > 0
    const percentual = Number(v.percentual) || 0
    const alerta = Number(v.saldo_litros) < 0 ? 'Saldo negativo: revise abastecimentos e percursos.'
        : Number(v.saldo_litros) > Number(v.capacidade_tanque) && configurado ? 'Saldo acima do tanque: revise os movimentos.' : ''
    return `<tr>
        <td><div class="combustivel-veiculo">
            <strong>${e(v.placa || 'Sem placa')}</strong>
            <span>${e(v.modelo || 'Veículo')}</span>
            <small>${v.ativo ? 'Ativo' : 'Inativo'}</small>
        </div></td>
        <td>${e(v.motoristas_nomes || 'Nenhum vinculado')}</td>
        <td>${e(v.combustivel || 'Não informado')}</td>
        <td><div class="combustivel-nivel" style="--cor-nivel: ${percentual <= 15 ? '#b83b32' : percentual <= 30 ? '#a36b13' : '#38794c'};">${configurado ? `<strong>${formatarCombustivel(percentual, 1)}%</strong>
            <span class="combustivel-trilho"><meter class="combustivel-barra" min="0" max="100" value="${Math.min(100, Math.max(0, percentual))}" aria-label="Percentual estimado do tanque de ${e(v.placa || v.modelo || 'veículo')}"></meter></span>
            <small>${formatarCombustivel(v.saldo_litros)} L de ${formatarCombustivel(v.capacidade_tanque)} L</small>`
            : '<span>Configure a capacidade e o consumo médio.</span>'}
            ${alerta ? `<small class="combustivel-alerta">${alerta}</small>` : ''}</div></td>
        <td>${configurado ? `${formatarCombustivel(v.consumo_medio)} km/l` : '—'}</td>
        <td>${formatarCombustivel(v.litros_consumidos)} L</td>
        <td>${v.divergencia?.quantidade ? `<button type="button" class="combustivel-conferencia combustivel-alerta" data-id="${e(v.id)}" onclick="detalhesCombustivel(this.dataset.id)">${v.divergencia.quantidade} intervalo(s): ${formatarCombustivel(v.divergencia.km)} km de divergência</button>` : '<span class="combustivel-conferencia-ok" title="Nenhuma divergência acima dos limites de alerta"><span aria-hidden="true">✓</span> Sem alerta</span>'}</td>
        <td><button type="button" class="combustivel-menu-gatilho" data-id="${e(v.id)}" onclick="menuAcoesVeiculoCombustivel(this.dataset.id)" aria-label="Ações do veículo" aria-haspopup="dialog" title="Ações do veículo">⋮</button></td>
    </tr>`

}

async function editarHodometroAbastecimento(id) {
    try {
        const a = await recuperarDado('combustivel_abastecimentos', id)
        if (!a?.id) throw new Error('Abastecimento não encontrado.')
        popupFormularioCombustivel({ titulo: 'Editar abastecimento', elemento: `
            <form data-id="${escaparAtributo(id)}" onsubmit="event.preventDefault(); salvarEdicaoHodometro(this)">
                <p>Abastecimento de ${escaparAtributo(a.data_abastecimento)}. Informe a leitura desse abastecimento.</p>
                <label>Litros abastecidos<input name="litros" inputmode="decimal" required value="${escaparAtributo(a.litros)}"></label>
                <label>Valor total (R$)<input name="valor_total" inputmode="decimal" required value="${escaparAtributo(a.valor_total)}"></label>
                <label>Hodômetro (km)<input name="hodometro" type="number" min="0" step="0.001" required value="${escaparAtributo(a.hodometro ?? '')}"></label>
                <label>${a.foto_hodometro ? 'Substituir foto do hodômetro (opcional)' : 'Foto do hodômetro'}<input name="foto_hodometro" type="file" accept="image/*" ${a.foto_hodometro ? '' : 'required'}></label>
                <p>Ao salvar, o mesmo pagamento no Omie será atualizado com os valores e departamentos calculados.</p>
                <p role="status"></p><button type="submit">Salvar abastecimento</button>
            </form>` })
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

async function salvarEdicaoHodometro(form) {
    const botao = form.querySelector('[type="submit"]')
    if (botao.disabled) return
    botao.disabled = true
    estadoEnvioCombustivel(form, true)
    let salvo = false
    try {
        const a = await recuperarDado('combustivel_abastecimentos', form.dataset.id)
        if (!a?.id) throw new Error('Abastecimento não encontrado.')
        const litros = numeroCombustivel(form.elements.litros.value)
        const valor_total = numeroCombustivel(form.elements.valor_total.value)
        if (litros <= 0 || valor_total <= 0 || Math.abs(valor_total * 100 - Math.round(valor_total * 100)) > 1e-7)
            throw new Error('Informe litros positivos e valor com até duas casas decimais.')
        const hodometro = numeroCombustivel(form.elements.hodometro.value)
        const marcado_em = horarioCombustivel(String(a.data_abastecimento).slice(0, 10), '00:00')
        if (new Date(marcado_em) > dataServidor()) throw new Error('A marcação não pode ser futura.')
        const input = form.elements.foto_hodometro
        let foto_hodometro = a.foto_hodometro
        if (input.files?.length) {
            if (!input.files[0].type.startsWith('image/')) throw new Error('Selecione uma imagem do hodômetro.')
            if (!form.fotoEnviada || form.arquivoEnviado !== input.files[0]) {
                const fotos = await importarAnexos({ input })
                if (!fotos?.[0]?.link) throw new Error('Não foi possível enviar a foto.')
                form.fotoEnviada = fotos[0].link
                form.arquivoEnviado = input.files[0]
            }
            foto_hodometro = form.fotoEnviada
        }
        if (!foto_hodometro) throw new Error('Inclua a foto do hodômetro.')
        const resposta = await enviar(`combustivel_abastecimentos/${a.id}`, {
            ...a, litros, valor_total, hodometro, marcado_em, foto_hodometro, sincronizar_omie: true
        })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar a marcação.')
        salvo = true
        removerPopup(form.closest('.popup').id)
        // Atualiza as duas tabelas do modal aberto, incluindo intervalos vizinhos recalculados.
        const filtro = { veiculo_id: { op: '=', value: a.veiculo_id } }
        const [abastecimentos, conferencias, rateios, pagamentos] = await Promise.all([
            consultarCombustivel('combustivel_abastecimentos', filtro),
            consultarCombustivel('vw_combustivel_conferencia_usos', filtro),
            consultarCombustivel('vw_combustivel_rateios', filtro),
            consultarCombustivel('vw_combustivel_pagamentos', filtro)
        ])
        controles.abastecimentosCombustivel.base = abastecimentos.map(item => ({ ...item,
            rateio: rateios.find(v => v.id === item.id), sincronizacao: pagamentos.find(v => v.id === item.id) }))
        controles.conferenciaHodometro.base = conferencias
        controles.abastecimentosCombustivel.priBase = null
        controles.conferenciaHodometro.priBase = null
        await paginacao('abastecimentosCombustivel')
        await paginacao('conferenciaHodometro')
    } catch (erro) {
        console.error('Falha ao editar abastecimento:', erro)
        const mensagem = salvo
            ? 'Abastecimento salvo. Falha ao atualizar as tabelas; reabra os movimentos. ' + erro.message
            : erro.message || 'Falha ao salvar o abastecimento.'
        const status = form.querySelector('[role="status"]')
        if (status) status.textContent = mensagem
        popup({ titulo: salvo ? 'Falha ao atualizar a tela' : 'Falha ao salvar abastecimento', mensagem: escaparAtributo(mensagem) })
    }
    finally { botao.disabled = false; estadoEnvioCombustivel(form, false) }
}

function criarLinhaAbastecimentoCombustivel(a) {
    const e = escaparAtributo, n = formatarCombustivel
    const r = a.rateio
    return `<tr><td>${e(formatarDataHistoricoCombustivel(a.data_abastecimento))}</td><td>${n(a.litros)} L</td><td>R$ ${n(a.valor_total)}</td>
        <td>${e(a.observacao || '—')}</td>
        <td>${n(r?.litros_pendentes)} L</td>
        <td>${(r?.departamentos || []).map(d => `<span>${e(d.departamento)}: ${n(d.litros)} L · R$ ${n(d.custo)}</span>`).join('') || '—'}</td>
        <td><div class="combustivel-sincronizacao"><small>${e(a.sincronizacao?.situacao || 'Aguardando sincronização')}</small>${a.sincronizacao?.erro ? `<small class="combustivel-alerta">${e(a.sincronizacao.erro)}</small>` : ''}</div><div class="combustivel-acoes-icones">${botaoAcaoCombustivel(r?.pagamento_criado ? 'abrirPagamento' : 'prepararPagamento', a.id)}
        <button type="button" class="combustivel-botao-icone" data-id="${e(a.id)}" title="Editar abastecimento" aria-label="Editar abastecimento" onclick="editarHodometroAbastecimento(this.dataset.id)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18a9 9 0 1 1 16 0M12 13l4-5M6 15h1m10 0h1M8 7l1 1m3-3v1"/><circle cx="12" cy="15" r="2"/></svg></button></div></td>
    </tr>`

}

function criarLinhaConsumoCombustivel(c) {
    const e = escaparAtributo, n = formatarCombustivel
    return `<tr><td>${e(formatarDataHistoricoCombustivel(c.data_consumo))}</td><td>${n(c.km)} km</td><td>${n(c.litros)} L</td>
                    <td>${e(c.departamento)}</td><td>${e(c.motorista || '—')}</td><td>${n(c.consumo_medio)} km/l</td>
                    <td>${e(c.ocorrencia_id)}</td></tr>`
}
