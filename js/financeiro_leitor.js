// ---------------- Leitor do formulário da fatura (js/financeiro.js formularioFaturaFin) ----------------
// Preenche a fatura a partir de um código, digitado, colado, lido por leitor USB (que "digita" e manda Enter),
// pela câmera ou de um arquivo (PDF do boleto ou foto):
//   - boleto bancário: linha digitável (47) ou código de barras (44): banco, valor e vencimento;
//   - concessionária / tributo (começa com 8): linha digitável (48) ou código de barras (44): valor e segmento;
//   - Pix copia e cola / QR Code (BR Code "000201..."): chave, recebedor, valor; o dinâmico pergunta ao banco
//     (servidor) valor, vencimento e recebedor;
//   - chave de acesso da DANFE / DACTE (44, código de barras da nota): fornecedor pelo CNPJ, número e,
//     com a nota no GCS ou no backup do Omie, valor e duplicatas.
// Servidor: gcs SCRIPTS/financeiro.js rota financeiro/ler-codigo (fatura em dobro, favorecido do cadastro,
// Pix dinâmico, nota recebida). Colunas fin_titulos.codigo_barras / pix_copia_cola
// (gcs migrations/financeiro-fatura-codigos.sql).
// Só aparece com a fatura editável. Campo já preenchido com outro valor: pergunta antes de trocar.

const BANCOS_LEITOR_FIN = {
    '001': 'Banco do Brasil', '004': 'Banco do Nordeste', '033': 'Santander', '041': 'Banrisul', '070': 'BRB', '077': 'Inter',
    '104': 'Caixa', '208': 'BTG Pactual', '212': 'Banco Original', '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank',
    '318': 'BMG', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú', '380': 'PicPay', '389': 'Mercantil', '399': 'HSBC',
    '403': 'Cora', '422': 'Safra', '633': 'Rendimento', '637': 'Sofisa', '655': 'Votorantim', '745': 'Citibank', '748': 'Sicredi', '756': 'Sicoob'
}
const SEGMENTOS_LEITOR_FIN = {
    1: 'Prefeitura', 2: 'Saneamento', 3: 'Energia elétrica / gás', 4: 'Telecomunicações', 5: 'Órgão do governo',
    6: 'Carnê / empresa', 7: 'Multa de trânsito', 9: 'Uso do banco'
}
const UFS_LEITOR_FIN = new Set([11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53])
const MODELOS_LEITOR_FIN = { 55: 'NF-e', 57: 'CT-e', 65: 'NFC-e', 67: 'CT-e OS' }
const ZXING_LEITOR_FIN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'

// ---------------- dígitos verificadores
function mod10LeitorFin(num) {
    let soma = 0, peso = 2
    for (let i = num.length - 1; i >= 0; i--) {
        let p = Number(num[i]) * peso
        if (p > 9) p = Math.floor(p / 10) + (p % 10)
        soma += p
        peso = peso === 2 ? 1 : 2
    }
    return (10 - (soma % 10)) % 10
}
function somaMod11LeitorFin(num) {
    let soma = 0, peso = 2
    for (let i = num.length - 1; i >= 0; i--) {
        soma += Number(num[i]) * peso
        peso = peso === 9 ? 2 : peso + 1
    }
    return soma % 11
}
// Boleto bancário: 0, 10 e 11 viram 1.
const dvBoletoLeitorFin = num => { const dv = 11 - somaMod11LeitorFin(num); return dv === 0 || dv > 9 ? 1 : dv }
// Arrecadação e chave de acesso: resto 0 ou 1 → 0.
const dvMod11LeitorFin = num => { const r = somaMod11LeitorFin(num); return r < 2 ? 0 : 11 - r }

// ---------------- boleto bancário
// Fator de vencimento: dias desde 07/10/1997; chegou a 9999 em 21/02/2025 e recomeçou em 1000 em 22/02/2025.
// Vale o ciclo que der a data mais perto de hoje.
function vencimentoFatorLeitorFin(fator) {
    if (!fator) return null
    const dia = (base, n) => { const d = new Date(`${base}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d }
    const hoje = new Date(`${hojeFin()}T12:00:00Z`)
    const candidatos = [dia('1997-10-07', fator)]
    if (fator >= 1000) candidatos.push(dia('2025-02-22', fator - 1000))
    candidatos.sort((a, b) => Math.abs(a - hoje) - Math.abs(b - hoje))
    return candidatos[0].toISOString().slice(0, 10)
}
function boletoDeBarrasLeitorFin(b) {
    const c1 = b.slice(0, 4) + b.slice(19, 24), c2 = b.slice(24, 34), c3 = b.slice(34, 44)
    return `${c1}${mod10LeitorFin(c1)}${c2}${mod10LeitorFin(c2)}${c3}${mod10LeitorFin(c3)}${b[4]}${b.slice(5, 19)}`
}
function barrasDeBoletoLeitorFin(l) {
    return l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31)
}
function lerBoletoLeitorFin(digitos) {
    let barras, linha
    if (digitos.length === 47) {
        linha = digitos
        const campos = [[0, 9], [10, 20], [21, 31]]
        if (campos.some(([i, f]) => mod10LeitorFin(linha.slice(i, f)) !== Number(linha[f])))
            return { erro: 'Linha digitável com dígito errado: confira os números.' }
        barras = barrasDeBoletoLeitorFin(linha)
    } else {
        barras = digitos
        linha = boletoDeBarrasLeitorFin(barras)
    }
    if (dvBoletoLeitorFin(barras.slice(0, 4) + barras.slice(5)) !== Number(barras[4]))
        return { erro: 'Código do boleto com dígito verificador errado: confira os números.' }
    const banco = barras.slice(0, 3)
    const valor = Number(barras.slice(9, 19)) / 100
    return {
        tipo: 'BOLETO', linha, banco, nomeBanco: BANCOS_LEITOR_FIN[banco] || `Banco ${banco}`,
        valor: valor > 0 ? valor : null, vencimento: vencimentoFatorLeitorFin(Number(barras.slice(5, 9)))
    }
}

// ---------------- concessionária / tributo (arrecadação, começa com 8)
function lerArrecadacaoLeitorFin(digitos) {
    let barras
    const ref = digitos[2]
    if (!'6789'.includes(ref)) return { erro: 'Código de concessionária com identificador de valor inválido.' }
    const dvBloco = ref === '6' || ref === '7' ? mod10LeitorFin : dvMod11LeitorFin
    if (digitos.length === 48) {
        const blocos = [0, 1, 2, 3].map(i => digitos.slice(i * 12, i * 12 + 12))
        if (blocos.some(b => dvBloco(b.slice(0, 11)) !== Number(b[11]))) return { erro: 'Linha digitável com dígito errado: confira os números.' }
        barras = blocos.map(b => b.slice(0, 11)).join('')
    } else barras = digitos
    if (dvBloco(barras.slice(0, 3) + barras.slice(4)) !== Number(barras[3]))
        return { erro: 'Código da concessionária com dígito verificador errado: confira os números.' }
    const linha = [0, 1, 2, 3].map(i => { const b = barras.slice(i * 11, i * 11 + 11); return b + dvBloco(b) }).join('')
    const segmento = Number(barras[1])
    // Valor efetivo (6/8); 7/9 = quantidade de moeda, sem valor em reais.
    const valor = ref === '6' || ref === '8' ? Number(barras.slice(4, 15)) / 100 : 0
    // Vencimento não tem lugar fixo: muitas concessionárias põem AAAAMMDD no campo livre. Só a data que
    // fizer sentido (de 60 dias atrás a 400 à frente) vira sugestão, e só para campo vazio.
    const inicio = segmento === 6 ? 23 : 19
    let vencimento = null
    const hoje = new Date(`${hojeFin()}T12:00:00Z`)
    for (let i = inicio; i + 8 <= 44 && !vencimento; i++) {
        const s = barras.slice(i, i + 8)
        const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
        const d = new Date(`${iso}T12:00:00Z`)
        if (!/^20[2-3]\d/.test(s) || isNaN(d) || d.toISOString().slice(0, 10) !== iso) continue
        const dias = (d - hoje) / 864e5
        if (dias >= -60 && dias <= 400) vencimento = iso
    }
    return {
        tipo: 'ARRECADACAO', linha, segmento: SEGMENTOS_LEITOR_FIN[segmento] || 'Concessionária',
        valor: valor > 0 ? valor : null, vencimento, vencimentoProvavel: Boolean(vencimento)
    }
}

// ---------------- chave de acesso (DANFE / DACTE)
function lerChaveLeitorFin(d) {
    const uf = Number(d.slice(0, 2)), mes = Number(d.slice(4, 6)), modelo = Number(d.slice(20, 22))
    if (!UFS_LEITOR_FIN.has(uf) || mes < 1 || mes > 12 || !MODELOS_LEITOR_FIN[modelo]) return null
    if (dvMod11LeitorFin(d.slice(0, 43)) !== Number(d[43])) return null
    return {
        tipo: 'NOTA', chave: d, modelo: MODELOS_LEITOR_FIN[modelo], cnpj: d.slice(6, 20),
        serie: String(Number(d.slice(22, 25))), numero: String(Number(d.slice(25, 34))), emissao: `${d.slice(4, 6)}/20${d.slice(2, 4)}`
    }
}

// ---------------- Pix (BR Code, EMV)
function tlvLeitorFin(texto) {
    const campos = {}
    let i = 0
    while (i + 4 <= texto.length) {
        const id = texto.slice(i, i + 2), n = Number(texto.slice(i + 2, i + 4))
        if (!/^\d{2}$/.test(id) || !Number.isInteger(n)) return null
        campos[id] = texto.slice(i + 4, i + 4 + n)
        i += 4 + n
    }
    return i === texto.length ? campos : null
}
function crc16LeitorFin(bytes) {
    let crc = 0xFFFF
    for (const b of bytes) {
        crc ^= b << 8
        for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}
function lerPixLeitorFin(texto) {
    texto = texto.trim()
    const corpo = texto.slice(0, -4), crc = texto.slice(-4).toUpperCase()
    const confere = crc16LeitorFin(new TextEncoder().encode(corpo)) === crc || crc16LeitorFin([...corpo].map(c => c.charCodeAt(0) & 0xFF)) === crc
    if (!corpo.endsWith('6304') || !confere) return { erro: 'Código Pix incompleto ou alterado (o final não confere). Copie de novo.' }
    const raiz = tlvLeitorFin(texto)
    const conta = raiz && tlvLeitorFin(raiz['26'] || '')
    if (!conta || String(conta['00']).toLowerCase() !== 'br.gov.bcb.pix') return { erro: 'Não é um código Pix.' }
    const chave = (conta['01'] || '').trim()
    const doc = /^\d{11}$|^\d{14}$/.test(chave) ? chave : ''
    return {
        tipo: 'PIX', copiaCola: texto, chave: chave || null, url: conta['25'] || null, dinamico: Boolean(conta['25']),
        nome: (raiz['59'] || '').trim() || null, cidade: (raiz['60'] || '').trim() || null,
        valor: Number(raiz['54']) > 0 ? Number(raiz['54']) : null, documento: doc || null,
        txid: (tlvLeitorFin(raiz['62'] || '') || {})['05'] || null, mensagem: conta['02'] || null
    }
}

// Texto qualquer → leitura (ou { erro }); null = ainda não é um código completo.
function interpretarCodigoFin(bruto) {
    const texto = String(bruto || '').trim()
    if (!texto) return null
    if (/^000201/.test(texto)) return texto.length >= 50 ? lerPixLeitorFin(texto) : null
    const d = texto.replace(/\D/g, '')
    if (d.length === 47) return lerBoletoLeitorFin(d)
    if (d.length === 48) return d[0] === '8' ? lerArrecadacaoLeitorFin(d) : { erro: 'Código com 48 números que não é de concessionária.' }
    if (d.length === 44) {
        if (d[0] === '8') {
            const a = lerArrecadacaoLeitorFin(d)
            if (!a.erro) return a
        }
        const chave = lerChaveLeitorFin(d)
        if (chave) return chave
        if (d[3] === '9') return lerBoletoLeitorFin(d)
        return { erro: 'Esses 44 números não são boleto nem chave de nota válidos.' }
    }
    return null
}

// ---------------- bloco no formulário
// editavel: fatura nova ou manual/editável sem estar excluída. Fatura que já existe: começa recolhido.
function blocoLeitorFin(t, editavel) {
    const ocultos = `
        <input type="hidden" name="codigo_barras" value="${escFin(t?.codigo_barras || '')}">
        <input type="hidden" name="pix_copia_cola" value="${escFin(t?.pix_copia_cola || '')}">`
    const lido = t?.codigo_barras ? `Boleto: <code>${escFin(formatarLinhaFin(t.codigo_barras))}</code>`
        : t?.pix_copia_cola ? 'Pix copia e cola guardado na fatura' : ''
    if (!editavel) return ocultos + (lido ? `<div class="fis-info">${lido}</div>` : '')
    return `${ocultos}
        <div class="fin-leitor" data-leitor-fin ${t ? 'data-recolhido' : ''}>
            <button type="button" class="fin-leitor-abrir" onclick="this.closest('[data-leitor-fin]').removeAttribute('data-recolhido'); this.closest('[data-leitor-fin]').querySelector('[data-leitor-entrada]').focus()">
                ${iconeLeitorFin('barras')} Preencher pelo boleto, Pix ou DANFE${lido ? ` <small>· ${lido}</small>` : ''}</button>
            <div class="fin-leitor-corpo">
                <div class="fin-leitor-topo">
                    ${iconeLeitorFin('barras')}
                    <div><b>Preencher pelo código</b>
                        <small>Linha digitável ou código de barras do boleto, Pix copia e cola, QR Code ou chave da DANFE. Digite, cole ou use o leitor.</small></div>
                </div>
                <div class="fin-leitor-linha">
                    <input class="fis-input" data-leitor-entrada autocomplete="off" spellcheck="false"
                        placeholder="Leia ou cole aqui o código" oninput="digitouCodigoFin(this)" onkeydown="if (event.key === 'Enter') { event.preventDefault(); lerCodigoFin(this.value, 'digitado') }">
                    <button type="button" class="fin-leitor-botao" title="Ler com a câmera (boleto, QR Code do Pix ou DANFE)" onclick="cameraCodigoFin()">${iconeLeitorFin('camera')}<span>Câmera</span></button>
                    <label class="fin-leitor-botao" title="Ler do PDF do boleto ou de uma foto">${iconeLeitorFin('arquivo')}<span>Arquivo</span>
                        <input type="file" accept="application/pdf,image/*" hidden onchange="arquivoCodigoFin(this)"></label>
                </div>
                <label class="fin-leitor-anexar"><input type="checkbox" data-leitor-anexar checked> Anexar à fatura o arquivo lido</label>
                <div data-leitor-resultado></div>
            </div>
        </div>`
}

function iconeLeitorFin(nome) {
    const d = {
        barras: '<path d="M3 5v14M6 5v14M9 5v14M13 5v14M15 5v14M18 5v14M21 5v14"/>',
        camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
        arquivo: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>'
    }[nome]
    return `<svg class="fin-leitor-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
}

const formatarLinhaFin = l => {
    const d = String(l || '').replace(/\D/g, '')
    if (d.length === 47) return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`
    if (d.length === 48) return d.match(/.{12}/g).map(b => `${b.slice(0, 11)}-${b[11]}`).join(' ')
    return d
}

// Leitor USB e colar: lê sozinho quando o código fica completo e válido (sem esperar o Enter).
let esperaDigitacaoFin = null
function digitouCodigoFin(input) {
    clearTimeout(esperaDigitacaoFin)
    esperaDigitacaoFin = setTimeout(() => {
        const r = interpretarCodigoFin(input.value)
        if (r && !r.erro) lerCodigoFin(input.value, 'digitado')
    }, 250)
}

function resultadoLeitorFin(html) {
    const alvo = document.querySelector('[data-leitor-resultado]')
    if (alvo) alvo.innerHTML = html
}

// Lê, completa no servidor, mostra e preenche. origem: digitado | camera | arquivo.
async function lerCodigoFin(texto, origem = 'digitado') {
    clearTimeout(esperaDigitacaoFin)
    const form = document.querySelector('[data-form-fatura]')
    if (!form) return false
    const leitura = interpretarCodigoFin(texto)
    if (!leitura) {
        resultadoLeitorFin('<div class="fin-leitor-erro">Código incompleto: o boleto tem 47 números (concessionária 48), o código de barras e a chave da nota 44, e o Pix começa com 000201.</div>')
        return false
    }
    if (leitura.erro) {
        resultadoLeitorFin(`<div class="fin-leitor-erro">${escFin(leitura.erro)}</div>`)
        return false
    }
    const entrada = form.querySelector('[data-leitor-entrada]')
    if (entrada && origem !== 'digitado') entrada.value = leitura.linha ? formatarLinhaFin(leitura.linha) : leitura.copiaCola || leitura.chave || ''
    let extra = {}
    try {
        overlayAguarde()
        extra = await apiFin('ler-codigo', {
            id: form.dataset.id || null,
            codigo_barras: leitura.linha || null,
            pix_copia_cola: leitura.copiaCola || null,
            pix_url: leitura.url || null,
            chave_pix: leitura.chave || null,
            documento: leitura.documento || null,
            chave_nfe: leitura.tipo === 'NOTA' ? leitura.chave : null
        })
    } catch (err) {
        extra = { falha: mensagemErroEst(err) }
    } finally {
        removerOverlay()
    }
    const cobranca = extra.pix && !extra.pix.erro ? extra.pix : null
    if (cobranca) Object.assign(leitura, {
        valor: cobranca.valor || leitura.valor, vencimento: cobranca.vencimento || null,
        nome: cobranca.nome || leitura.nome, documento: cobranca.documento || leitura.documento, chaveCobranca: cobranca.chave
    })
    mostrarLeituraFin(leitura, extra)
    await preencherPelaLeituraFin(leitura, extra)
    return true
}

function mostrarLeituraFin(l, extra) {
    const linhas = []
    const item = (rotulo, valor) => valor ? linhas.push(`<span>${rotulo}</span><b>${valor}</b>`) : null
    let titulo = ''
    if (l.tipo === 'BOLETO') {
        titulo = `Boleto · ${escFin(l.nomeBanco)}`
        item('Valor', l.valor ? dinheiro(l.valor) : 'não vem no código')
        item('Vencimento', l.vencimento ? dataFin(l.vencimento) : 'não vem no código')
        item('Linha digitável', `<code>${escFin(formatarLinhaFin(l.linha))}</code>`)
    } else if (l.tipo === 'ARRECADACAO') {
        titulo = `Conta de consumo / tributo · ${escFin(l.segmento)}`
        item('Valor', l.valor ? dinheiro(l.valor) : 'não vem no código')
        item('Vencimento', l.vencimento ? `${dataFin(l.vencimento)} <small>(provável, confira)</small>` : 'não vem no código')
        item('Linha digitável', `<code>${escFin(formatarLinhaFin(l.linha))}</code>`)
    } else if (l.tipo === 'PIX') {
        titulo = `Pix ${l.dinamico ? 'dinâmico (cobrança)' : 'estático'}`
        item('Recebedor', escFin([l.nome, l.cidade].filter(Boolean).join(' · ')))
        item('Chave', escFin(l.chave || l.chaveCobranca || ''))
        item('Valor', l.valor ? dinheiro(l.valor) : 'em aberto (quem paga digita)')
        item('Vencimento', l.vencimento ? dataFin(l.vencimento) : '')
        if (extra.pix?.erro) item('Cobrança', `<span class="fin-leitor-aviso-texto">não deu para consultar no banco (${escFin(extra.pix.erro)}); o código fica guardado para pagar</span>`)
        if (extra.pix?.solicitacao) item('Mensagem', escFin(extra.pix.solicitacao))
    } else if (l.tipo === 'NOTA') {
        const n = extra.nota
        titulo = `${escFin(l.modelo)} nº ${escFin(l.numero)} · série ${escFin(l.serie)}`
        item('Emitente', escFin(n?.emitente_nome || docFormatadoFis(l.cnpj)))
        item('Emissão', n?.emissao ? dataFin(n.emissao) : escFin(l.emissao))
        item('Valor', n?.valor ? dinheiro(n.valor) : '')
        if (!n?.encontrada) item('Nota', 'não está nas Notas recebidas nem no backup do Omie: só fornecedor e número')
    }
    if (extra.favorecido) item(termoFin('favorecido', document.querySelector('[data-form-fatura]')?.dataset.tipo).replace(/^./, c => c.toUpperCase()),
        `${escFin(extra.favorecido.nome)} <small>(${{ documento: 'pelo CPF/CNPJ', chave_pix: 'pela chave Pix do cadastro', fatura_anterior: 'já pago nessa chave' }[extra.favorecido.por]})</small>`)

    const avisos = []
    if (extra.falha) avisos.push(`Sem consulta ao servidor (${escFin(extra.falha)}): preenchido só com o que está no código.`)
    if (extra.duplicadas?.length) avisos.push(`Esse código já está em ${extra.duplicadas.length === 1 ? 'outra fatura' : `${extra.duplicadas.length} faturas`}: ${extra.duplicadas.map(linkFaturaLeitorFin).join(', ')}. Confira antes de salvar para não pagar em dobro.`)
    if (extra.nota?.faturas?.length) avisos.push(`Essa nota já tem ${extra.nota.faturas.length === 1 ? 'fatura' : `${extra.nota.faturas.length} faturas`}: ${extra.nota.faturas.map(linkFaturaLeitorFin).join(', ')}.`)

    const dups = extra.nota?.duplicatas || []
    const lancada = d => (extra.nota?.faturas || []).some(f => String(f.vencimento).slice(0, 10) === d.vencimento && Math.abs(Number(f.valor) - d.valor) < 0.01)
    const blocoDups = dups.length > 1 ? `
        <div class="fin-leitor-dups">
            <span>Duplicatas da nota: escolha a desta fatura (as outras pela aba <b>Repetições</b> ou numa nova fatura)</span>
            ${dups.map((d, i) => `
                <button type="button" class="fis-mini${lancada(d) ? ' fin-leitor-dup-lancada' : ''}" onclick="usarDuplicataFin(${i})" title="${lancada(d) ? 'Já tem fatura com esse vencimento e valor' : 'Usar esta duplicata'}">
                    ${escFin(d.numero || String(i + 1).padStart(3, '0'))} · ${dataFin(d.vencimento)} · ${dinheiro(d.valor)}${lancada(d) ? ' ✓' : ''}</button>`).join('')}
        </div>` : ''
    ultimaNotaLeitorFin = l.tipo === 'NOTA' ? { leitura: l, extra } : null

    resultadoLeitorFin(`
        <div class="fin-leitor-lido">
            <div class="fin-leitor-lido-titulo">${titulo}</div>
            <div class="fin-leitor-dados">${linhas.join('')}</div>
            ${avisos.map(a => `<div class="fin-leitor-aviso">${a}</div>`).join('')}
            ${blocoDups}
        </div>`)
}

const linkFaturaLeitorFin = f => `<a href="#" onclick="event.preventDefault(); formularioFaturaFin('${escFin(f.tipo || 'PAGAR')}', '${escFin(f.id)}')">${escFin(f.participante_nome || `#${f.id}`)} ${dataFin(f.vencimento)} ${dinheiro(f.valor)}</a>`

let ultimaNotaLeitorFin = null
function usarDuplicataFin(i) {
    const n = ultimaNotaLeitorFin
    const d = n?.extra?.nota?.duplicatas?.[i]
    if (!d) return
    const total = n.extra.nota.duplicatas.length
    return aplicarCamposLeituraFin([
        { nome: 'vencimento', rotulo: 'Vencimento', valor: d.vencimento, mostrar: dataFin },
        { nome: 'valor', rotulo: 'Valor', valor: r2Fin(d.valor), mostrar: dinheiro },
        { nome: 'numero_documento', rotulo: 'Nº do documento', valor: total > 1 ? `${n.leitura.numero}/${i + 1}` : n.leitura.numero }
    ])
}

// O que cada leitura preenche. Favorecido: o do cadastro (se achou) ou o nome que veio no Pix.
async function preencherPelaLeituraFin(l, extra) {
    const campos = []
    const tipo = document.querySelector('[data-form-fatura]')?.dataset.tipo
    const add = (nome, rotulo, valor, mostrar = null, soVazio = false) => { if (valor != null && valor !== '') campos.push({ nome, rotulo, valor, mostrar, soVazio }) }
    // Código guardado de outra leitura (boleto ↔ Pix): limpa, sem perguntar (campo oculto).
    const limpar = nome => campos.push({ nome, rotulo: nome, valor: '' })
    const fav = extra.favorecido
    if (fav) add('favorecido', termoFin('favorecido', tipo), { id: fav.id || '', nome: fav.nome, documento: fav.cnpj || '' }, v => escFin(v.nome))
    if (l.tipo === 'BOLETO' || l.tipo === 'ARRECADACAO') {
        add('valor', 'Valor', l.valor, dinheiro)
        add('vencimento', 'Vencimento', l.vencimento, dataFin, l.vencimentoProvavel)
        add('forma_pagamento', 'Forma de pagamento', '15', () => 'Boleto')
        add('codigo_barras', 'Linha digitável', l.linha, formatarLinhaFin)
        limpar('pix_copia_cola')
    } else if (l.tipo === 'PIX') {
        limpar('codigo_barras')
        if (!fav && l.nome) add('favorecido', termoFin('favorecido', tipo), { id: '', nome: l.nome, documento: l.documento || '' }, v => `${escFin(v.nome)} <small>(sem cadastro)</small>`)
        add('valor', 'Valor', l.valor, dinheiro)
        add('vencimento', 'Vencimento', l.vencimento, dataFin)
        add('forma_pagamento', 'Forma de pagamento', '17', () => 'PIX')
        add('chave_pix', 'Chave Pix', l.dinamico ? null : l.chave)
        add('participante_documento', 'CPF/CNPJ', l.documento || fav?.cnpj ? docFormatadoFis(l.documento || fav.cnpj) : null)
        add('pix_copia_cola', 'Pix copia e cola', l.copiaCola, () => 'guardado na fatura')
    } else if (l.tipo === 'NOTA') {
        const n = extra.nota || {}
        if (!fav && n.emitente_nome) add('favorecido', termoFin('favorecido', tipo), { id: '', nome: n.emitente_nome, documento: n.emitente_documento || l.cnpj }, v => `${escFin(v.nome)} <small>(sem cadastro)</small>`)
        else if (!fav) add('participante_documento', 'CPF/CNPJ', docFormatadoFis(n.emitente_documento || l.cnpj))
        add('numero_documento', 'Nº do documento', l.numero)
        const dups = n.duplicatas || []
        if (dups.length === 1) {
            add('vencimento', 'Vencimento', dups[0].vencimento, dataFin)
            add('valor', 'Valor', r2Fin(dups[0].valor), dinheiro)
        } else if (!dups.length && n.valor) add('valor', 'Valor', r2Fin(n.valor), dinheiro)
    }
    return aplicarCamposLeituraFin(campos)
}

function valorAtualCampoFin(form, nome) {
    if (nome === 'favorecido') {
        const n = form.querySelector('[name="participante_nome"]').value.trim()
        return n ? { id: form.dataset.cliente || '', nome: n } : null
    }
    return form.querySelector(`[name="${nome}"]`)?.value ?? ''
}
function mesmoValorFin(nome, atual, novo) {
    if (nome === 'favorecido') return atual && ((novo.id && String(atual.id) === String(novo.id)) || (!novo.id && atual.nome.toUpperCase() === novo.nome.toUpperCase()))
    if (nome === 'valor') return Math.abs(Number(atual) - Number(novo)) < 0.005
    if (nome === 'participante_documento') return String(atual).replace(/\D/g, '') === String(novo).replace(/\D/g, '')
    return String(atual).trim() === String(novo).trim()
}

// Campo vazio: preenche. Campo com outro valor: lista e pergunta (substituir tudo ou só os vazios).
async function aplicarCamposLeituraFin(campos) {
    const form = document.querySelector('[data-form-fatura]')
    if (!form) return
    const vazio = v => v == null || v === '' || (typeof v === 'object' && !v.nome)
    const preencher = [], trocar = []
    for (const c of campos) {
        const atual = valorAtualCampoFin(form, c.nome)
        if (c.valor === '' && vazio(atual)) continue
        if (vazio(atual)) preencher.push(c)
        else if (!mesmoValorFin(c.nome, atual, c.valor) && !c.soVazio) trocar.push({ ...c, atual })
    }
    let escolha = 'todos'
    const visiveis = trocar.filter(c => !['codigo_barras', 'pix_copia_cola'].includes(c.nome))
    if (visiveis.length) {
        const mostrar = (c, v) => c.mostrar ? c.mostrar(v) : escFin(v)
        escolha = await escolherTrocaLeituraFin(`
            <div class="fin-leitor-troca">
                <p>A fatura já tem dados diferentes do código lido:</p>
                <table class="fis-tabela"><thead><tr><th>Campo</th><th>Hoje</th><th>Do código</th></tr></thead><tbody>
                    ${visiveis.map(c => `<tr><td>${escFin(c.rotulo)}</td><td>${c.nome === 'favorecido' ? escFin(c.atual.nome) : mostrar(c, c.atual)}</td><td><b>${mostrar(c, c.valor)}</b></td></tr>`).join('')}
                </tbody></table>
                ${preencher.length ? `<p><small>Os campos vazios (${preencher.map(c => escFin(c.rotulo)).join(', ')}) são preenchidos de qualquer forma.</small></p>` : ''}
            </div>`)
        if (!escolha) return
    }
    const aplicar = escolha === 'todos' ? [...preencher, ...trocar] : [...preencher, ...trocar.filter(c => !visiveis.includes(c))]
    for (const c of aplicar) definirCampoLeituraFin(form, c.nome, c.valor)
    sincronizarTopoFin()
    form.querySelectorAll('.fin-leitor-preenchido').forEach(e => e.classList.remove('fin-leitor-preenchido'))
    for (const c of aplicar) {
        const el = c.nome === 'favorecido' ? form.querySelector('[name="favorecido_fin"]') : form.querySelector(`[name="${c.nome}"]:not([type=hidden])`)
        el?.classList.add('fin-leitor-preenchido')
    }
    setTimeout(() => form.querySelectorAll('.fin-leitor-preenchido').forEach(e => e.classList.remove('fin-leitor-preenchido')), 2500)
}

function definirCampoLeituraFin(form, nome, valor) {
    if (nome !== 'favorecido') {
        const el = form.querySelector(`[name="${nome}"]`)
        if (el) el.value = valor
        return
    }
    const span = form.querySelector('[name="favorecido_fin"]')
    span.textContent = valor.nome
    if (valor.id) span.id = valor.id
    else span.removeAttribute('id')
    form.querySelector('[name="participante_nome"]').value = valor.nome
    form.dataset.cliente = valor.id || ''
    form.querySelector('[data-vinculo-fin]').hidden = !valor.id
    if (valor.documento) form.querySelector('[name="participante_documento"]').value = docFormatadoFis(valor.documento)
    const avatar = form.querySelector('[data-avatar-fin]')
    pintarAvatarFin(avatar, valor.nome, null)
    if (valor.id) recuperarDado('clientes', valor.id).then(c => { if (form.dataset.cliente === String(valor.id)) pintarAvatarFin(avatar, valor.nome, c?.foto) }).catch(() => { })
}

// 'todos' | 'vazios' | null (fechou).
function escolherTrocaLeituraFin(elemento) {
    return new Promise(resolve => {
        const chave = crypto.randomUUID()
        const id = popup({
            titulo: 'Trocar o que já está na fatura?', elemento, modal: true, cor: '#fff',
            botoes: [
                { id: `vazios-${chave}`, texto: 'Manter e preencher só os vazios', img: 'cancel' },
                { id: `todos-${chave}`, texto: 'Trocar pelos do código' }
            ]
        })
        const obs = new MutationObserver(() => { if (!document.getElementById(id)) fim(null) })
        function fim(r) { obs.disconnect(); removerPopup(id); resolve(r) }
        document.getElementById(`vazios-${chave}`).addEventListener('click', () => fim('vazios'), { once: true })
        document.getElementById(`todos-${chave}`).addEventListener('click', () => fim('todos'), { once: true })
        obs.observe(document.body, { childList: true })
    })
}

// ---------------- câmera e arquivo
let carregandoZxingFin = null
function carregarZxingFin() {
    if (globalThis.ZXing) return Promise.resolve(globalThis.ZXing)
    carregandoZxingFin ??= new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = ZXING_LEITOR_FIN
        s.onload = () => resolve(globalThis.ZXing)
        s.onerror = () => { carregandoZxingFin = null; reject(new Error('Não foi possível carregar o leitor de código.')) }
        document.head.appendChild(s)
    })
    return carregandoZxingFin
}
const FORMATOS_LEITOR_FIN = ['qr_code', 'itf', 'code_128']
async function detectorNativoFin() {
    if (!('BarcodeDetector' in globalThis)) return null
    try {
        const suportados = await BarcodeDetector.getSupportedFormats()
        const formatos = FORMATOS_LEITOR_FIN.filter(f => suportados.includes(f))
        return formatos.length === FORMATOS_LEITOR_FIN.length ? new BarcodeDetector({ formats: formatos }) : null
    } catch { return null }
}
async function leitorZxingFin() {
    const Z = await carregarZxingFin()
    const dicas = new Map()
    dicas.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODE_128])
    dicas.set(Z.DecodeHintType.TRY_HARDER, true)
    return new Z.BrowserMultiFormatReader(dicas)
}

async function cameraCodigoFin() {
    if (!navigator.mediaDevices?.getUserMedia) return popup({ mensagem: 'Este navegador não libera a câmera. Use o leitor, digite o código ou leia do arquivo.' })
    const chave = crypto.randomUUID()
    const id = popup({
        titulo: 'Ler pela câmera', cor: '#fff',
        elemento: `
            <div class="fin-leitor-camera">
                <video id="video-${chave}" playsinline muted></video>
                <div class="fin-leitor-mira"></div>
                <small id="dica-${chave}">Aponte para o QR Code do Pix, o código de barras do boleto ou o da DANFE. No boleto, deixe as barras na horizontal e bem perto.</small>
            </div>`
    })
    const video = document.getElementById(`video-${chave}`)
    let parar = () => { }, lido = false
    const obs = new MutationObserver(() => { if (!document.getElementById(id)) { obs.disconnect(); parar() } })
    obs.observe(document.body, { childList: true })
    const achou = texto => {
        if (lido || !interpretarCodigoFin(texto)) return
        lido = true
        removerPopup(id)
        lerCodigoFin(texto, 'camera')
    }
    try {
        const nativo = await detectorNativoFin()
        if (nativo) {
            const fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
            let ativo = true
            parar = () => { ativo = false; fluxo.getTracks().forEach(t => t.stop()) }
            if (!document.getElementById(id)) return parar()
            video.srcObject = fluxo
            await video.play()
            const ciclo = async () => {
                if (!ativo) return
                try { for (const c of await nativo.detect(video)) achou(c.rawValue) } catch { }
                if (ativo && !lido) setTimeout(ciclo, 200)
            }
            ciclo()
        } else {
            const leitor = await leitorZxingFin()
            parar = () => { try { leitor.reset() } catch { } }
            if (!document.getElementById(id)) return
            await leitor.decodeFromConstraints({ video: { facingMode: 'environment', width: { ideal: 1920 } } }, video, r => { if (r) achou(r.getText()) })
        }
    } catch (err) {
        parar()
        const dica = document.getElementById(`dica-${chave}`)
        const negado = /NotAllowed|Permission/i.test(err?.name || err?.message)
        if (dica) dica.innerHTML = `<b>${negado ? 'A câmera foi bloqueada no navegador: libere no cadeado da barra de endereço.' : escFin(err?.message || 'Não foi possível abrir a câmera.')}</b>`
    }
}

// Arquivo: PDF → procura no texto a linha digitável / Pix / chave; sem texto (digitalizado) ou imagem, lê as barras.
async function arquivoCodigoFin(input) {
    const arquivo = input.files?.[0]
    if (!arquivo) return
    overlayAguarde()
    let achado = null
    try {
        const imagens = []
        if (/pdf$/i.test(arquivo.type) || /\.pdf$/i.test(arquivo.name)) {
            const pdfjs = await carregarPdfjsRH()
            const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
            for (let p = 1; p <= Math.min(doc.numPages, 5) && !achado; p++) {
                const pagina = await doc.getPage(p)
                const itens = (await pagina.getTextContent()).items.map(i => i.str)
                achado = codigoNoTextoFin(itens.join(' ')) || codigoNoTextoFin(itens.join(''))
                if (!achado && p <= 2) {
                    const vp = pagina.getViewport({ scale: 2.5 })
                    const canvas = document.createElement('canvas')
                    canvas.width = vp.width; canvas.height = vp.height
                    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
                    imagens.push(canvas)
                }
            }
        } else if (/^image\//.test(arquivo.type)) {
            imagens.push(await createImageBitmap(arquivo))
        }
        for (const img of imagens) {
            if (achado) break
            achado = await codigoNaImagemFin(img)
        }
    } catch (err) {
        removerOverlay()
        input.value = ''
        return resultadoLeitorFin(`<div class="fin-leitor-erro">Não deu para ler o arquivo: ${escFin(err?.message || err)}</div>`)
    }
    removerOverlay()
    if (!achado) {
        input.value = ''
        return resultadoLeitorFin('<div class="fin-leitor-erro">Nenhum boleto, Pix ou chave de nota encontrado no arquivo. Digite ou cole o código.</div>')
    }
    const ok = await lerCodigoFin(achado, 'arquivo')
    if (ok && document.querySelector('[data-leitor-anexar]')?.checked) await anexarFin(input)
    else input.value = ''
}

// Prioridade: boleto (o que se paga) > Pix > chave da nota.
function codigoNoTextoFin(texto) {
    const valido = s => { const r = interpretarCodigoFin(s); return r && !r.erro ? r : null }
    const pix = (texto.match(/000201[\x20-\x7E]{40,}?6304[0-9A-Fa-f]{4}/g) || []).flatMap(s => [s, s.replace(/\s+/g, '')])
    const blocos = texto.match(/[\d][\d.\s-]{42,120}\d/g) || []
    const candidatos = []
    for (const b of blocos) {
        const d = b.replace(/\D/g, '')
        for (const n of [47, 48, 44]) for (let i = 0; i + n <= d.length; i++) candidatos.push(d.slice(i, i + n))
    }
    const lidos = candidatos.map(c => [c, valido(c)]).filter(([, r]) => r)
    const ordem = { BOLETO: 0, ARRECADACAO: 0, PIX: 1, NOTA: 2 }
    const pixOk = pix.map(p => [p, valido(p)]).filter(([, r]) => r)
    const todos = [...lidos, ...pixOk].sort((a, b) => ordem[a[1].tipo] - ordem[b[1].tipo])
    return todos[0]?.[0] || null
}

async function codigoNaImagemFin(img) {
    const nativo = await detectorNativoFin()
    const lidos = []
    if (nativo) {
        try { lidos.push(...(await nativo.detect(img)).map(c => c.rawValue)) } catch { }
    } else {
        const leitor = await leitorZxingFin()
        let canvas = img
        if (!(img instanceof HTMLCanvasElement)) {
            canvas = document.createElement('canvas')
            canvas.width = img.width; canvas.height = img.height
            canvas.getContext('2d').drawImage(img, 0, 0)
        }
        try { lidos.push((await leitor.decodeFromImageUrl(canvas.toDataURL('image/png'))).getText()) } catch { }
    }
    return lidos.find(t => { const r = interpretarCodigoFin(t); return r && !r.erro }) || null
}
