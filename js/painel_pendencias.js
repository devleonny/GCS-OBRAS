// Painel de pendências (só adm: acesso sistema.painel_pendencias, 22/11/2026). Ícone de pessoas na barra do
// topo (js/websocket.js). Todos os usuários e o que está com cada um: avisos não lidos, pedidos pendentes
// (lançados e assumidos de quem saiu), etapas de chamado em que é executor e orçamentos em andamento como
// analista (pelo e-mail do contato). SÓ LEITURA: nada aqui marca aviso como lido (gcs /notificacoes/painel
// e /notificacoes/painel-usuario).

const estadoPainelPend = { usuarios: [], busca: '', ordem: 'pendencias', desligados: false, idJanela: null }

const FONTES_PAINEL_PEND = {
    pendencias: 'Etapas de chamado', promessas: 'Pedidos pendentes', pagamentos: 'Pagamentos', rh: 'RH',
    comunicados: 'Comunicados', comunicado: 'Comunicado', manual: 'Aviso manual', remessas: 'Remessas',
    remessas_resumo: 'Remessas', precos: 'Preços', recuperacao: 'Ferramentas', caixa: 'Caixa'
}

const totalPendPainel = u => (Number(u.pedidos_pendentes) || 0) + (Number(u.pedidos_assumidos) || 0) + (Number(u.chamados) || 0) + (Number(u.orcamentos) || 0)

async function abrirPainelPendencias() {
    overlayAguarde()
    try {
        const { usuarios } = await chamarNotificacoes('painel')
        estadoPainelPend.usuarios = usuarios || []
    } catch (err) {
        return popup({ mensagem: err.message || 'Não foi possível abrir o painel.' })
    }
    const esc = escaparAtributo
    const janelaAberta = estadoPainelPend.idJanela && document.getElementById(estadoPainelPend.idJanela)
    if (janelaAberta) removerPopup(estadoPainelPend.idJanela)
    estadoPainelPend.idJanela = popup({
        titulo: 'Pendências dos usuários',
        elemento: `
            <div class="painel-pend">
                <div class="painel-pend-barra">
                    <input type="search" placeholder="Buscar pessoa, login, permissão ou setor" value="${esc(estadoPainelPend.busca)}"
                        oninput="estadoPainelPend.busca = this.value; desenharPainelPend()">
                    <select onchange="estadoPainelPend.ordem = this.value; desenharPainelPend()">
                        ${[['pendencias', 'Mais pendências'], ['avisos', 'Mais avisos não lidos'], ['nome', 'Nome']]
                            .map(([v, t]) => `<option value="${v}" ${estadoPainelPend.ordem === v ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <label><input type="checkbox" ${estadoPainelPend.desligados ? 'checked' : ''}
                        onchange="estadoPainelPend.desligados = this.checked; desenharPainelPend()"> Mostrar desligados</label>
                    <button type="button" onclick="abrirPainelPendencias()">Atualizar</button>
                </div>
                <div class="painel-pend-resumo"></div>
                <small class="painel-pend-nota">Só para ver: abrir este painel não marca nenhum aviso como lido.</small>
                <div class="painel-pend-lista"></div>
            </div>`
    })
    desenharPainelPend()
}

function desenharPainelPend() {
    const painel = document.getElementById(estadoPainelPend.idJanela)?.querySelector('.painel-pend')
    if (!painel) return
    const esc = escaparAtributo
    const termo = String(estadoPainelPend.busca || '').trim().toLowerCase()
    const lista = estadoPainelPend.usuarios
        .filter(u => estadoPainelPend.desligados || !u.desligado || totalPendPainel(u) > 0)
        .filter(u => !termo || [u.nome, u.usuario, u.permissao, u.setor].some(v => String(v || '').toLowerCase().includes(termo)))
        .sort((a, b) => estadoPainelPend.ordem === 'nome'
            ? String(a.nome || a.usuario).localeCompare(String(b.nome || b.usuario), 'pt-BR')
            : estadoPainelPend.ordem === 'avisos'
                ? (b.avisos - a.avisos) || (totalPendPainel(b) - totalPendPainel(a))
                : (totalPendPainel(b) - totalPendPainel(a)) || (b.avisos - a.avisos))

    const soma = campo => lista.reduce((s, u) => s + (Number(u[campo]) || 0), 0)
    painel.querySelector('.painel-pend-resumo').innerHTML = `
        <span><b>${lista.length}</b> pessoas</span>
        <span><b>${soma('pedidos_pendentes')}</b> pedidos pendentes</span>
        <span><b>${soma('chamados')}</b> etapas de chamado</span>
        <span><b>${soma('orcamentos')}</b> orçamentos em andamento</span>
        <span><b>${soma('avisos')}</b> avisos não lidos</span>`

    const numero = (n, extra = '') => Number(n) ? `<b>${Number(n)}</b>${extra}` : '<span class="zero">—</span>'
    painel.querySelector('.painel-pend-lista').innerHTML = `
        <table class="painel-pend-tabela">
            <thead><tr>
                <th>Pessoa</th><th title="Lançados pela pessoa (+ assumidos de quem saiu)">Pedidos pendentes</th>
                <th title="Chamados em que a pessoa é executora da etapa atual">Etapas de chamado</th>
                <th title="Orçamentos em andamento com o contato da pessoa como analista">Orçamentos</th>
                <th>Avisos não lidos</th>
            </tr></thead>
            <tbody>${lista.map(u => {
                const fontes = Object.entries(u.avisos_fontes || {}).sort((a, b) => b[1] - a[1])
                    .map(([f, n]) => `${FONTES_PAINEL_PEND[f] || f}: ${n}`).join(' · ')
                return `
                <tr class="${u.desligado ? 'desligado' : ''}" tabindex="0" onclick="abrirPendenciasUsuario('${esc(u.usuario)}')"
                    onkeydown="if (event.key === 'Enter') abrirPendenciasUsuario('${esc(u.usuario)}')">
                    <td>
                        <span class="painel-pend-pessoa"><i class="presenca ${u.presenca === 'online' ? 'on' : ''}" title="${u.presenca === 'online' ? 'Online' : 'Offline'}"></i>
                            <b>${esc(u.nome || u.usuario)}</b></span>
                        <small>${esc(u.usuario)}${u.permissao ? ` · ${esc(u.permissao)}` : ''}${u.setor ? ` · ${esc(u.setor)}` : ''}</small>
                        ${u.desligado ? `<small class="painel-pend-deslig">Desligado${u.responsavel ? ` · pendências com ${esc(u.responsavel)}` : ' · sem responsável'}</small>` : ''}
                    </td>
                    <td>${numero(u.pedidos_pendentes, Number(u.pedidos_assumidos) ? ` <small>+${u.pedidos_assumidos} assumidos</small>` : '')}</td>
                    <td>${numero(u.chamados)}</td>
                    <td>${numero(u.orcamentos)}</td>
                    <td title="${esc(fontes)}">${numero(u.avisos)}</td>
                </tr>`
            }).join('') || '<tr><td colspan="5" class="painel-pend-vazio">Ninguém encontrado.</td></tr>'}</tbody>
        </table>`
}

async function abrirPendenciasUsuario(usuario) {
    overlayAguarde()
    let d
    try {
        d = await chamarNotificacoes('painel-usuario', { usuario })
    } catch (err) {
        return popup({ mensagem: err.message || 'Não foi possível carregar.' })
    }
    const esc = escaparAtributo
    const u = estadoPainelPend.usuarios.find(x => x.usuario === usuario) || { usuario }
    const data = v => v ? new Date(v).toLocaleDateString('pt-BR') : ''
    const dataHora = v => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
    const secao = (titulo, n, corpo) => `
        <details class="painel-pend-secao" ${n ? 'open' : ''}>
            <summary>${titulo} <b>${n}</b></summary>
            ${n ? corpo : '<p class="painel-pend-vazio">Nada.</p>'}
        </details>`

    const pedidos = (d.promessas || []).map(p => `
        <tr><td><b>${esc(p.contrato || '')}</b></td><td>${esc(p.cliente || '')}</td><td>${Number(p.dias) || 0} d</td>
            <td>${String(p.executor || '').toLowerCase() === usuario.toLowerCase() ? 'lançado por esta pessoa' : `assumido de ${esc(p.executor || '')}`}</td></tr>`).join('')
    const chamados = (d.chamados || []).map(c => `
        <tr><td><b>${esc(c.chamado || '')}</b></td><td>${esc(c.unidade || '')}</td><td>${esc(c.nome || '')}</td>
            <td>${esc(String(c.dtCorrecao || '').split('-').reverse().join('/'))}${c.dtCorrecaoFinal ? ` → ${esc(String(c.dtCorrecaoFinal).split('-').reverse().join('/'))}` : ''}</td></tr>`).join('')
    const orcamentos = (d.orcamentos || []).map(o => `
        <tr class="clicavel" onclick="abrirEsquema('${esc(o.id)}')" title="Abrir o Histórico do orçamento">
            <td><b>${esc(o.contrato || '')}</b></td><td>${esc(o.cliente || '')}</td><td>${esc(o.status || 'SEM STATUS')}</td>
            <td>${o.total != null ? dinheiro(o.total) : ''}</td><td>${data(o.alterado)}</td></tr>`).join('')
    const avisos = (d.avisos || []).map(a => `
        <tr><td>${dataHora(a.criado_em)}</td><td>${esc(FONTES_PAINEL_PEND[a.fonte] || a.fonte || '')}</td>
            <td><b>${esc(a.titulo || '')}</b>${a.corpo ? `<small>${esc(a.corpo)}</small>` : ''}</td></tr>`).join('')

    popup({
        titulo: `Pendências de ${u.nome || usuario}`,
        elemento: `
            <div class="painel-pend painel-pend-detalhe">
                <small class="painel-pend-nota">${esc(usuario)}${u.permissao ? ` · ${esc(u.permissao)}` : ''}${u.desligado ? ` · desligado, pendências com ${esc(u.responsavel || 'ninguém')}` : ''} · só para ver, nada é marcado como lido.</small>
                ${secao('Pedidos pendentes', (d.promessas || []).length, `<table class="painel-pend-tabela"><thead><tr><th>Orçamento</th><th>Cliente</th><th>Há</th><th></th></tr></thead><tbody>${pedidos}</tbody></table>`)}
                ${secao('Etapas de chamado (executor da etapa atual)', (d.chamados || []).length, `<table class="painel-pend-tabela"><thead><tr><th>Chamado</th><th>Unidade</th><th>Etapa</th><th>Prazo</th></tr></thead><tbody>${chamados}</tbody></table>`)}
                ${secao('Orçamentos em andamento', (d.orcamentos || []).length, `<table class="painel-pend-tabela"><thead><tr><th>Orçamento</th><th>Cliente</th><th>Status</th><th>Total</th><th>Alterado</th></tr></thead><tbody>${orcamentos}</tbody></table>`)}
                ${secao('Avisos não lidos', Number(d.avisos_total) || 0, `<table class="painel-pend-tabela"><thead><tr><th>Quando</th><th>Tipo</th><th>Aviso</th></tr></thead><tbody>${avisos}</tbody></table>
                    ${Number(d.avisos_total) > (d.avisos || []).length ? `<small class="painel-pend-nota">Mostrando os ${(d.avisos || []).length} mais recentes de ${d.avisos_total}.</small>` : ''}`)}
            </div>`
    })
}
