// Painel de pendências (só adm: acesso sistema.painel_pendencias, 22/11/2026). Ícone de pessoas na barra do
// topo (js/websocket.js). Todos os usuários e o que está com cada um: avisos não lidos, pedidos pendentes
// (lançados e assumidos de quem saiu), etapas de chamado em que é executor e orçamentos em andamento como
// analista (pelo e-mail do contato). SÓ LEITURA: nada aqui marca aviso como lido (gcs /notificacoes/painel
// e /notificacoes/painel-usuario).

const estadoPainelPend = { usuarios: [], busca: '', ordem: 'pendencias', desligados: false }

const FONTES_PAINEL_PEND = {
    pendencias: 'Etapas de chamado', promessas: 'Pedidos pendentes', pagamentos: 'Pagamentos', rh: 'RH',
    comunicados: 'Comunicados', comunicado: 'Comunicado', manual: 'Aviso manual', remessas: 'Remessas',
    remessas_resumo: 'Remessas', precos: 'Preços', precos_resumo: 'Preços', rh_resumo: 'RH', recuperacao: 'Ferramentas',
    caixa: 'Caixa', backup: 'Backup', cadastro_link: 'Cadastro por link'
}

const totalPendPainel = u => (Number(u.pedidos_pendentes) || 0) + (Number(u.pedidos_assumidos) || 0) + (Number(u.chamados) || 0) + (Number(u.orcamentos) || 0)

async function abrirPainelPendencias() {
    overlayAguarde()
    try {
        const { usuarios } = await chamarNotificacoes('painel')
        estadoPainelPend.usuarios = usuarios || []
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: err.message || 'Não foi possível abrir o painel.' })
    }
    const esc = escaparAtributo
    // Tela inteira (antes era popup); o detalhe de cada pessoa continua abrindo por cima, em popup.
    tela.innerHTML = `
        <div class="pagina-conteudo">
            <div class="cabecalho-pagina"><h2>Pendências dos usuários</h2></div>
            <div class="painel-pend painel-pend-tela">
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
                <details class="painel-pend-indicadores" ${localStorage.getItem('painelPendGraficos') === 'fechado' ? '' : 'open'}
                    ontoggle="localStorage.setItem('painelPendGraficos', this.open ? 'aberto' : 'fechado')">
                    <summary>Gráficos: de onde vêm as pendências</summary>
                    <div class="painel-pend-graficos"></div>
                </details>
                <small class="painel-pend-nota">Só para ver: abrir este painel não marca nenhum aviso como lido. Os gráficos acompanham a busca; clique num setor para filtrar por ele.</small>
                <div class="painel-pend-lista"></div>
                <div class="painel-pend-tip" role="tooltip" hidden></div>
            </div>
        </div>`
    ligarDicasPainelPend()
    desenharPainelPend()
}

// Cores fixas por tipo de pendência (validadas para daltonismo): a mesma no cartão, no gráfico e na barrinha da tabela.
const COR_PAINEL_PEND = { chamados: '#2a78d6', pedidos: '#eb6834', orcamentos: '#1baf7a', avisos: '#7c8a99' }
// Idade: rampa de um tom só (claro = recente, escuro = antigo).
const IDADE_PAINEL_PEND = {
    cores: { a: '#86b6ef', b: '#3987e5', c: '#1c5cab', d: '#0d366b' },
    avisos: { a: 'até 7 dias', b: '8 a 30 dias', c: '31 a 90 dias', d: 'mais de 90 dias' },
    pedidos: { a: 'até 7 dias', b: '8 a 30 dias', c: '31 a 90 dias', d: 'mais de 90 dias' },
    orcamentos: { a: 'mexido em até 30 dias', b: '31 a 90 dias', c: '91 a 365 dias', d: 'mais de 1 ano' }
}

// Dica flutuante dos gráficos: um elemento só, guiado por [data-tip] (texto com quebras de linha).
function ligarDicasPainelPend() {
    const painel = tela.querySelector('.painel-pend-tela')
    const tip = painel?.querySelector('.painel-pend-tip')
    if (!tip) return
    const mostrar = e => {
        const alvo = e.target.closest?.('[data-tip]')
        if (!alvo || !painel.contains(alvo)) return tip.hidden = true
        tip.textContent = alvo.dataset.tip
        tip.hidden = false
        const { innerWidth: w } = window
        const larg = tip.offsetWidth
        tip.style.left = `${Math.min(e.clientX + 14, w - larg - 8)}px`
        tip.style.top = `${e.clientY + 16}px`
    }
    painel.addEventListener('mousemove', mostrar)
    painel.addEventListener('mouseleave', () => tip.hidden = true)
    painel.addEventListener('scroll', () => tip.hidden = true, true)
}

// Soma objetos {chave: n} de todas as pessoas da lista.
function somarObjPainelPend(lista, campo) {
    const total = {}
    for (const u of lista)
        for (const [k, n] of Object.entries(u[campo] || {}))
            total[k] = (total[k] || 0) + (Number(n) || 0)
    return total
}

// Top N e o resto em "Outros/Outras".
function topPainelPend(obj, n, outros = 'Outros') {
    const itens = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    if (itens.length <= n) return itens
    const resto = itens.slice(n - 1).reduce((s, [, v]) => s + v, 0)
    return [...itens.slice(0, n - 1), [outros, resto, true]]
}

function desenharGraficosPend(lista) {
    const alvo = tela.querySelector('.painel-pend-graficos')
    if (!alvo) return
    const esc = escaparAtributo
    const milhar = n => Number(n || 0).toLocaleString('pt-BR')
    const pct = (n, t) => t ? `${Math.round(n / t * 100)}%` : '0%'
    const C = COR_PAINEL_PEND

    // Uma linha de barra horizontal com 1+ segmentos; largura relativa ao maior total do gráfico.
    const linha = ({ rotulo, segs, maximo, dica, clique, destaque }) => {
        const total = segs.reduce((s, x) => s + x.n, 0)
        return `
            <div class="pp-linha ${clique ? 'clicavel' : ''}" data-tip="${esc(dica)}" ${clique ? `onclick="${clique}"` : ''}>
                <span class="pp-rot" title="${esc(rotulo)}">${esc(rotulo)}</span>
                <span class="pp-trilho"><span class="pp-barra" style="width: ${Math.max(total / maximo * 100, total ? 1.5 : 0)}%">${segs.filter(s => s.n)
                    .map(s => `<i style="flex: ${s.n}; background: ${s.cor}"></i>`).join('')}</span></span>
                <span class="pp-val">${milhar(total)}${destaque ? `<small>${destaque}</small>` : ''}</span>
            </div>`
    }
    const legenda = itens => `<div class="pp-legenda">${itens.map(([cor, t]) => `<span><i style="background: ${cor}"></i>${t}</span>`).join('')}</div>`
    const cartao = (titulo, sub, corpo, extra = '') => `
        <section class="pp-cartao ${extra}"><header><h3>${titulo}</h3>${sub ? `<p>${sub}</p>` : ''}</header>${corpo}</section>`
    const vazio = '<p class="pp-vazio">Nada nesta seleção.</p>'

    // 1. Por setor: etapas de chamado + pedidos + orçamentos (empilhado).
    const setores = {}
    for (const u of lista) {
        const s = String(u.setor || '').trim() || 'Sem setor'
        const x = setores[s] ||= { chamados: 0, pedidos: 0, orcamentos: 0, pessoas: 0 }
        x.chamados += Number(u.chamados) || 0
        x.pedidos += (Number(u.pedidos_pendentes) || 0) + (Number(u.pedidos_assumidos) || 0)
        x.orcamentos += Number(u.orcamentos) || 0
        if (totalPendPainel(u)) x.pessoas++
    }
    const setLista = Object.entries(setores).map(([s, x]) => [s, x, x.chamados + x.pedidos + x.orcamentos])
        .filter(([, , t]) => t > 0).sort((a, b) => b[2] - a[2]).slice(0, 10)
    const maxSet = Math.max(1, ...setLista.map(([, , t]) => t))
    const gSetor = setLista.length ? legenda([[C.chamados, 'Etapas de chamado'], [C.pedidos, 'Pedidos pendentes'], [C.orcamentos, 'Orçamentos']]) +
        setLista.map(([s, x, t]) => linha({
            rotulo: s, maximo: maxSet,
            segs: [{ n: x.chamados, cor: C.chamados }, { n: x.pedidos, cor: C.pedidos }, { n: x.orcamentos, cor: C.orcamentos }],
            dica: `${s} · ${x.pessoas} pessoa(s) com pendência\nEtapas de chamado: ${milhar(x.chamados)}\nPedidos pendentes: ${milhar(x.pedidos)}\nOrçamentos em andamento: ${milhar(x.orcamentos)}\nTotal: ${milhar(t)}\n(clique para filtrar)`,
            clique: s === 'Sem setor' ? '' : `filtrarSetorPainelPend('${esc(s)}')`
        })).join('') : vazio

    // 2. Etapas de chamado: vencidas × no prazo.
    const etapas = somarObjPainelPend(lista, 'chamados_etapas')
    const vencidas = somarObjPainelPend(lista, 'chamados_vencidas')
    const etLista = topPainelPend(etapas, 10, 'Outras etapas')
    const vencOutras = Object.entries(vencidas).filter(([k]) => !etLista.some(([e, , o]) => !o && e === k)).reduce((s, [, v]) => s + v, 0)
    const maxEt = Math.max(1, ...etLista.map(([, n]) => n))
    const VENC = '#1c5cab', PRAZO = '#b7d3f6'
    const gEtapas = etLista.length ? legenda([[VENC, 'Prazo vencido'], [PRAZO, 'No prazo']]) +
        etLista.map(([e, n, outros]) => {
            const v = outros ? vencOutras : (vencidas[e] || 0)
            return linha({
                rotulo: e, maximo: maxEt, segs: [{ n: v, cor: VENC }, { n: n - v, cor: PRAZO }],
                dica: `${e}\n${milhar(n)} etapa(s) · ${milhar(v)} com prazo vencido (${pct(v, n)})`,
                destaque: v ? `${pct(v, n)} venc.` : ''
            })
        }).join('') : vazio

    // 3. Orçamentos em andamento por status.
    const stLista = topPainelPend(somarObjPainelPend(lista, 'orcamentos_status'), 9, 'Outros status')
    const totalOrc = stLista.reduce((s, [, n]) => s + n, 0)
    const maxSt = Math.max(1, ...stLista.map(([, n]) => n))
    const gStatus = stLista.length ? stLista.map(([st, n]) => linha({
        rotulo: st, maximo: maxSt, segs: [{ n, cor: C.orcamentos }],
        dica: `${st}\n${milhar(n)} orçamento(s) · ${pct(n, totalOrc)} dos em andamento${st === 'SEM STATUS' ? '\nSem chamado ligado: provavelmente parados' : ''}`,
        destaque: pct(n, totalOrc)
    })).join('') : vazio

    // 4. Há quanto tempo: barras 100% por faixa de idade.
    const idade = (tipo, rotulo, campo) => {
        const obj = somarObjPainelPend(lista, campo)
        const total = Object.values(obj).reduce((s, n) => s + n, 0)
        if (!total) return ''
        const nomes = IDADE_PAINEL_PEND[tipo]
        return `
            <div class="pp-idade">
                <div class="pp-idade-topo"><b>${rotulo}</b><span>${milhar(total)}</span></div>
                <div class="pp-idade-barra">${['a', 'b', 'c', 'd'].filter(f => obj[f]).map(f => `
                    <i style="flex: ${obj[f]}; background: ${IDADE_PAINEL_PEND.cores[f]}" data-tip="${esc(`${rotulo}: ${nomes[f]}\n${milhar(obj[f])} (${pct(obj[f], total)})`)}">${obj[f] / total >= 0.08 ? `<span class="${f === 'a' ? 'escuro' : ''}">${pct(obj[f], total)}</span>` : ''}</i>`).join('')}</div>
                ${legenda(['a', 'b', 'c', 'd'].map(f => [IDADE_PAINEL_PEND.cores[f], nomes[f]]))}
            </div>`
    }
    const gIdade = (idade('pedidos', 'Pedidos pendentes', 'pedidos_idade') + idade('avisos', 'Avisos não lidos', 'avisos_idade') +
        idade('orcamentos', 'Orçamentos (última alteração)', 'orcamentos_idade')) || vazio

    // 5. Avisos não lidos por tipo.
    // Agrupa pelo nome exibido (rh e rh_resumo viram "RH").
    const avPorNome = {}
    for (const [f, n] of Object.entries(somarObjPainelPend(lista, 'avisos_fontes'))) {
        const nome = FONTES_PAINEL_PEND[f] || f
        avPorNome[nome] = (avPorNome[nome] || 0) + n
    }
    const avLista = topPainelPend(avPorNome, 8, 'Outros tipos')
    const totalAv = avLista.reduce((s, [, n]) => s + n, 0)
    const maxAv = Math.max(1, ...avLista.map(([, n]) => n))
    const gAvisos = avLista.length ? avLista.map(([f, n]) => linha({
        rotulo: f, maximo: maxAv, segs: [{ n, cor: C.avisos }], destaque: pct(n, totalAv),
        dica: `${f}\n${milhar(n)} aviso(s) não lido(s) · ${pct(n, totalAv)}`
    })).join('') : vazio

    // 6. Concentração: quem segura mais pendências (top 8 pessoas, empilhado como no setor).
    const pessoas = [...lista].filter(u => totalPendPainel(u) > 0).sort((a, b) => totalPendPainel(b) - totalPendPainel(a))
    const totalGeral = pessoas.reduce((s, u) => s + totalPendPainel(u), 0)
    const top = pessoas.slice(0, 8)
    const maxP = Math.max(1, ...top.map(totalPendPainel))
    const partTop5 = pessoas.slice(0, 5).reduce((s, u) => s + totalPendPainel(u), 0)
    const gPessoas = top.length ? `<p class="pp-frase">As 5 pessoas mais carregadas seguram <b>${pct(partTop5, totalGeral)}</b> das pendências (${milhar(partTop5)} de ${milhar(totalGeral)}).</p>` +
        top.map(u => {
            const ped = (Number(u.pedidos_pendentes) || 0) + (Number(u.pedidos_assumidos) || 0)
            const nome = u.nome || u.usuario
            return linha({
                rotulo: nome, maximo: maxP,
                segs: [{ n: Number(u.chamados) || 0, cor: C.chamados }, { n: ped, cor: C.pedidos }, { n: Number(u.orcamentos) || 0, cor: C.orcamentos }],
                dica: `${nome}${u.setor ? ` · ${u.setor}` : ''}\nEtapas de chamado: ${milhar(u.chamados)}\nPedidos pendentes: ${milhar(ped)}\nOrçamentos em andamento: ${milhar(u.orcamentos)}\n(clique para ver o detalhe)`,
                clique: `abrirPendenciasUsuario('${esc(u.usuario)}')`
            })
        }).join('') : vazio

    alvo.innerHTML =
        cartao('Pendências por setor', 'Etapas de chamado, pedidos pendentes e orçamentos em andamento de quem está em cada setor', gSetor) +
        cartao('Quem concentra', 'Pessoas com mais pendências (mesmas cores)', gPessoas) +
        cartao('Etapas de chamado travadas', 'Em que etapa estão os chamados e quantos já passaram do prazo', gEtapas) +
        cartao('Orçamentos em andamento por status', 'SEM STATUS = sem chamado ligado', gStatus) +
        cartao('Há quanto tempo', 'Claro = recente, escuro = antigo', gIdade) +
        cartao('Avisos não lidos por tipo', 'De onde vêm os avisos que ninguém abriu', gAvisos)
}

function filtrarSetorPainelPend(setor) {
    estadoPainelPend.busca = setor
    const campo = tela.querySelector('.painel-pend-barra input[type="search"]')
    if (campo) campo.value = setor
    desenharPainelPend()
}

function desenharPainelPend() {
    const painel = tela.querySelector('.painel-pend-tela')
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
    const milhar = n => Number(n || 0).toLocaleString('pt-BR')
    const COR = COR_PAINEL_PEND
    const pct = (n, t) => t ? `${Math.round(n / t * 100)}%` : '0%'
    const kpi = (n, rotulo, cor, sub = '') => `<div class="painel-pend-kpi" style="--cor: ${cor}"><b>${milhar(n)}</b><span>${rotulo}</span>${sub ? `<small>${sub}</small>` : ''}</div>`

    // Indicadores de cada cartão (somados da lista filtrada).
    const objSoma = campo => somarObjPainelPend(lista, campo)
    const pedIdade = objSoma('pedidos_idade'), avIdade = objSoma('avisos_idade'), orcIdade = objSoma('orcamentos_idade')
    const vencidas = Object.values(objSoma('chamados_vencidas')).reduce((s, n) => s + n, 0)
    const semStatus = objSoma('orcamentos_status')['SEM STATUS'] || 0
    const avFontes = Object.entries(objSoma('avisos_fontes')).sort((a, b) => b[1] - a[1])[0]
    const online = lista.filter(u => u.presenca === 'online').length
    const comPend = lista.filter(u => totalPendPainel(u) > 0).length
    const valorPed = soma('pedidos_valor')
    painel.querySelector('.painel-pend-resumo').innerHTML =
        kpi(lista.length, 'pessoas', '#475569', `${comPend} com pendência · ${online} online`) +
        kpi(soma('pedidos_pendentes'), 'pedidos pendentes', COR.pedidos,
            `${milhar(pedIdade.d || 0)} há +90 dias${valorPed ? ` · ${dinheiro(valorPed)}` : ''}`) +
        kpi(soma('chamados'), 'etapas de chamado', COR.chamados, `${pct(vencidas, soma('chamados'))} com prazo vencido`) +
        kpi(soma('orcamentos'), 'orçamentos em andamento', COR.orcamentos,
            `${pct(semStatus, soma('orcamentos'))} sem status · ${milhar((orcIdade.c || 0) + (orcIdade.d || 0))} parados +90 d`) +
        kpi(soma('avisos'), 'avisos não lidos', COR.avisos,
            `${avFontes ? `${pct(avFontes[1], soma('avisos'))} ${(FONTES_PAINEL_PEND[avFontes[0]] || avFontes[0]).toLowerCase()}` : ''}${avIdade.b || avIdade.c || avIdade.d ? ` · ${milhar((avIdade.b || 0) + (avIdade.c || 0) + (avIdade.d || 0))} com +7 d` : ''}`)

    desenharGraficosPend(lista)

    // Barrinha proporcional ao maior valor da coluna na lista filtrada: mostra de relance quem está mais carregado.
    const maior = campo => Math.max(1, ...lista.map(u => Number(u[campo]) || 0))
    const max = { pedidos_pendentes: maior('pedidos_pendentes'), chamados: maior('chamados'), orcamentos: maior('orcamentos'), avisos: maior('avisos') }
    const numero = (u, campo, cor, extra = '') => {
        const n = Number(u[campo]) || 0
        if (!n) return '<span class="zero">—</span>'
        return `<span class="painel-pend-num"><b>${milhar(n)}</b><i style="--cor: ${cor}; --p: ${(n / max[campo]).toFixed(3)}"></i>${extra}</span>`
    }
    const iniciais = nome => String(nome || '').trim().split(/\s+/).filter(Boolean)
        .filter((p, i, a) => i === 0 || i === a.length - 1).map(p => p[0]).join('').toUpperCase() || '?'

    painel.querySelector('.painel-pend-lista').innerHTML = `
        <table class="painel-pend-tabela">
            <thead><tr>
                <th>Pessoa</th><th class="num" title="Lançados pela pessoa (+ assumidos de quem saiu)">Pedidos pend.</th>
                <th class="num" title="Chamados em que a pessoa é executora da etapa atual">Etapas chamado</th>
                <th class="num" title="Orçamentos em andamento com o contato da pessoa como analista">Orçamentos</th>
                <th class="num">Avisos não lidos</th>
            </tr></thead>
            <tbody>${lista.map(u => {
                const fontes = Object.entries(u.avisos_fontes || {}).sort((a, b) => b[1] - a[1])
                    .map(([f, n]) => `${FONTES_PAINEL_PEND[f] || f}: ${n}`).join(' · ')
                return `
                <tr class="${u.desligado ? 'desligado' : ''}" tabindex="0" onclick="abrirPendenciasUsuario('${esc(u.usuario)}')"
                    onkeydown="if (event.key === 'Enter') abrirPendenciasUsuario('${esc(u.usuario)}')">
                    <td>
                        <div class="painel-pend-pessoa">
                            <span class="painel-pend-avatar">${esc(iniciais(u.nome || u.usuario))}<i class="presenca ${u.presenca === 'online' ? 'on' : ''}" title="${u.presenca === 'online' ? 'Online' : 'Offline'}"></i></span>
                            <div class="painel-pend-pessoa-texto">
                                <b title="${esc(u.nome || u.usuario)}">${esc(u.nome || u.usuario)}</b>
                                <small>${esc(u.usuario)}${u.permissao ? ` · ${esc(u.permissao)}` : ''}${u.setor ? ` · ${esc(u.setor)}` : ''}</small>
                                ${u.desligado ? `<small class="painel-pend-deslig">Desligado${u.responsavel ? ` · pendências com ${esc(u.responsavel)}` : ' · sem responsável'}</small>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="num">${numero(u, 'pedidos_pendentes', COR.pedidos, Number(u.pedidos_assumidos) ? `<small>+${u.pedidos_assumidos} assumidos</small>` : '')}</td>
                    <td class="num">${numero(u, 'chamados', COR.chamados)}</td>
                    <td class="num">${numero(u, 'orcamentos', COR.orcamentos)}</td>
                    <td class="num" title="${esc(fontes)}">${numero(u, 'avisos', COR.avisos)}</td>
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
