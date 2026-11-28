// LINK COMPARTILHÁVEL DO CHECKLIST (30 dias): quem recebe preenche no celular em checklist.html, sem login.
// Servidor: gcs/SCRIPTS/planos_diarios_links.js. O que chega já vale; aqui o analista confere o dia.

const dataHoraLinkDiario = v => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

// Só quem tem usuário no GCS (técnicos primeiro); a autoria do que chegar é o login da pessoa.
const PERFIS_LINK_DIARIO = { novo: 'cadastro novo, ainda sem acesso ao GCS', user: 'sem acesso ao GCS', visitante: 'sem acesso ao GCS' }
fontesEscolha.pessoasLinkDiario = {
    valor: 'id', rotulo: p => p.nome, limite: 40, detalhe: p => [p.usuario, PERFIS_LINK_DIARIO[p.permissao] || p.permissao, p.cidade].filter(Boolean).join(' · '),
    buscar: async (palavras, campo, termo) => (await apiPlanoDiario('linkPessoas', { termo })).pessoas
}

async function compartilharPlanoDiario() {
    const e = estadoPlanoDiario
    if (!e.plano) return
    try {
        const { links } = await apiPlanoDiario('links', { plano: e.plano.id })
        popup({
            titulo: 'Compartilhar checklist',
            elemento: `
                <div class="dp-form dp-links" data-plano="${escaparAtributo(e.plano.id)}" data-titulo="${escaparAtributo(e.plano.titulo)}">
                    <b>${escaparAtributo(e.plano.titulo)}</b>
                    <small>Quem tiver o link preenche quantidades, fotos e marcações deste checklist, em qualquer dia, sem precisar entrar no GCS, e já vale. O que chegar fica no nome do usuário escolhido. Crie um para cada pessoa: assim aparece quem fez e dá para cancelar só o dela.</small>
                    <div class="dp-barra">
                        ${campoEscolhaHtml({ fonte: 'pessoasLinkDiario', name: 'pessoaLink', placeholder: 'Quem vai preencher? Pesquise por nome, usuário ou cidade…' })}
                        <button type="button" onclick="acaoLinkDiario(this, 'criar')">Gerar link de 30 dias</button>
                    </div>
                    <div class="dp-links-lista">${linhasLinksDiario(links, e.plano.titulo)}</div>
                </div>`
        })
    } catch (err) { popup({ mensagem: err.message }) }
}

// Celular do cadastro já abre a conversa certa; sem celular válido, o WhatsApp pergunta para quem mandar.
const foneLinkDiario = c => /^\d{10,11}$/.test(c || '') ? `55${c}` : /^55\d{10,11}$/.test(c || '') ? c : ''

function linhasLinksDiario(links, titulo) {
    if (!links.length) return '<p class="diario-vazio">Nenhum link criado.</p>'
    return links.map(l => `
        <div class="dp-link ${l.url ? '' : 'dp-link-fora'}">
            <div><b>${escaparAtributo(l.nome)}</b><small>${escaparAtributo(l.usuario || '')}</small>
                <small>${l.revogado_em ? `Cancelado em ${dataHoraLinkDiario(l.revogado_em)}` : `${l.ativo ? '' : 'Usuário inativo no GCS: o link não abre · '}${l.vencido ? 'Venceu' : 'Vale até'} ${dataHoraLinkDiario(l.expira_em)}`}
                    · ${l.ultimo_acesso ? `último acesso ${dataHoraLinkDiario(l.ultimo_acesso)}` : 'ainda não abriu'} · criado por ${escaparAtributo(l.criado_por)}</small></div>
            <div class="dp-barra">
                ${l.url ? `<button type="button" onclick="copiarLinkDiario(this, '${escaparAtributo(l.url)}')">Copiar</button>
                    <a href="https://wa.me/${foneLinkDiario(l.celular)}?text=${encodeURIComponent(`Olá! Segue o link para preencher o checklist "${titulo}" (quantidades e fotos):\n${l.url}`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
                ${l.revogado_em ? '' : `<button type="button" onclick="acaoLinkDiario(this, 'renovar', '${l.id}')">Renovar</button>
                    <button type="button" class="dp-perigo" onclick="acaoLinkDiario(this, 'revogar', '${l.id}')">Cancelar link</button>`}
            </div>
        </div>`).join('')
}

async function copiarLinkDiario(botao, url) {
    try { await navigator.clipboard.writeText(url); botao.textContent = 'Copiado' }
    catch { popup({ mensagem: `Copie o link: ${escaparAtributo(url)}` }) }
}

async function acaoLinkDiario(alvo, acao, id) {
    const raiz = alvo.closest('.dp-links')
    const campo = raiz.querySelector('.ce-campo')
    if (raiz.dataset.ocupado) return
    if (acao === 'revogar' && !(await confirmarPopup({ mensagem: 'Cancelar este link? Ele para de abrir na hora e não volta. O que já foi preenchido fica.', textoConfirmar: 'Cancelar link' }))) return
    raiz.dataset.ocupado = '1'
    try {
        const { links } = await apiPlanoDiario('linkAcao', { plano: raiz.dataset.plano, acao, id, pessoa: lerEscolha(campo) })
        if (acao === 'criar') ceLimpar(campo.querySelector('.ce-limpar'))
        raiz.querySelector('.dp-links-lista').innerHTML = linhasLinksDiario(links, raiz.dataset.titulo)
    } catch (err) { popup({ mensagem: err.message }) }
    finally { delete raiz.dataset.ocupado }
}

// Faixa do dia preenchido pelo link: quem, quando e o botão de conferir.
const pendenteLinkDiario = dia => !!dia?.dados?.link && !dia.dados.conferido

function faixaLinkDiario() {
    const e = estadoPlanoDiario
    document.getElementById('faixaLinkDiario')?.remove()
    const dia = e.plano && !e.origem ? e.dias.find(d => d.data_ref === e.data) : null
    if (!dia?.dados?.link) return
    const { link, conferido } = dia.dados
    document.getElementById('diasPlanoDiario').insertAdjacentHTML('afterend', `
        <div id="faixaLinkDiario" class="diario-faixa-link ${conferido ? 'conferido' : ''}">
            <span>Preenchido por <b>${escaparAtributo(link.nome)}</b> pelo link em ${dataHoraLinkDiario(link.em)}${conferido
                ? ` · conferido por <b>${escaparAtributo(conferido.usuario)}</b> em ${dataHoraLinkDiario(conferido.em)}` : ' · ainda não conferido'}</span>
            ${conferido ? '' : '<button type="button" onclick="conferirDiaPlanoDiario()">Marcar como conferido</button>'}
        </div>`)
}

async function conferirDiaPlanoDiario() {
    const e = estadoPlanoDiario
    const id = e.plano?.id
    try {
        await apiPlanoDiario('conferir', { plano: id, data: e.data })
        const dados = await apiPlanoDiario('detalhe', { plano: id })
        if (e.plano?.id !== id) return
        // Só o dia conferido muda: o que está digitado na tela continua.
        const dia = e.dias.find(d => d.data_ref === e.data), novo = dados.dias.find(d => d.data_ref === e.data)
        if (dia && novo) dia.dados.conferido = novo.dados.conferido
        desenharDiasPlanoDiario()
        controlesDocumentoDiario()
    } catch (err) { popup({ mensagem: err.message }) }
}

// Tela aberta enquanto alguém preenche pelo link: confere a cada 30 s e atualiza, sem atropelar edição nem popup.
setInterval(async () => {
    const e = estadoPlanoDiario
    const livre = () => e.plano && !e.alterado && !e.carregando && !e.renderizando && !e.dias.conferindo && !document.hidden
        && document.getElementById('planoDiarioConteudo') && !document.querySelector('.popup, .dl-tela')
        && !e.documento?.activeElement?.matches('input')
    if (!livre()) return
    const id = e.plano.id
    const assinatura = (p, dias) => JSON.stringify([p.versao, p.galeria, dias.map(d => [d.data_ref, d.versao, d.dados.conferido])])
    try {
        const novo = await apiPlanoDiario('detalhe', { plano: id })
        if (!livre() || e.plano.id !== id || assinatura(novo.plano, novo.dias) === assinatura(e.plano, e.dias)) return
        Object.assign(e, novo)
        await renderizarPlanoDiario()
    } catch { /* sem conexão: tenta na próxima */ }
}, 30000)
