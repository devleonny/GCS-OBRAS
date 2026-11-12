// ---------------- Leitor de documentos do RH (ASO, Ficha de EPI, certificados) ----------------
// Ao anexar um PDF no formulário de documento (js/rh.js), lê o texto no navegador (pdf.js, js/vendor)
// e mostra o que achou: tipo, pessoa (pelo CPF), datas, exames do ASO (código eSocial + data), EPIs
// entregues (descrição + CA) e validade do certificado. Ao salvar, o tipo e o "Feito em" do documento vêm
// daqui e os exames/EPIs viram lançamentos na Ficha (js/rh_ficha.js), sem repetir o que já existe.
// PDF escaneado (sem texto) não é lido: o formulário segue como sempre.
// As funções de leitura são puras (linhas de texto → dados): testadas em tests/rh-leitor.test.cjs.

const PDFJS_RH = { script: 'js/vendor/pdf.min.js', worker: 'js/vendor/pdf.worker.min.js' }
let carregandoPdfjsRH = null

// pdf.js só é baixado quando alguém anexa um PDF no RH.
function carregarPdfjsRH() {
    if (globalThis.pdfjsLib) return Promise.resolve(globalThis.pdfjsLib)
    carregandoPdfjsRH ??= new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = PDFJS_RH.script
        script.onload = () => {
            globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_RH.worker
            resolve(globalThis.pdfjsLib)
        }
        script.onerror = () => { carregandoPdfjsRH = null; reject(new Error('Não foi possível carregar o leitor de PDF.')) }
        document.head.appendChild(script)
    })
    return carregandoPdfjsRH
}

// Texto do PDF em linhas, na ordem da página: junta os pedaços com a mesma altura (y) e separa colunas
// distantes com dois espaços (como o pdftotext -layout), o que mantém "data   código - exame" juntos.
async function linhasDoPdfRH(pdfjs, dados, maxPaginas = 3) {
    const pdf = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise
    const linhas = []
    for (let n = 1; n <= Math.min(pdf.numPages, maxPaginas); n++) {
        const pagina = await pdf.getPage(n)
        const { items } = await pagina.getTextContent()
        const pedacos = items
            .filter(i => i.str && i.str.trim())
            .map(i => ({ texto: i.str, x: i.transform[4], y: i.transform[5], largura: i.width || 0, altura: Math.abs(i.transform[3]) || 8 }))
            .sort((a, b) => b.y - a.y || a.x - b.x)
        const grupos = []
        for (const p of pedacos) {
            const grupo = grupos.find(g => Math.abs(g.y - p.y) <= Math.max(2, p.altura * 0.35))
            grupo ? grupo.itens.push(p) : grupos.push({ y: p.y, itens: [p] })
        }
        grupos.sort((a, b) => b.y - a.y)
        for (const g of grupos) {
            g.itens.sort((a, b) => a.x - b.x)
            let linha = '', fim = null
            for (const p of g.itens) {
                const espaco = fim == null ? '' : p.x - fim > p.altura * 1.2 ? '   ' : p.x - fim > p.altura * 0.15 ? ' ' : ''
                linha += espaco + p.texto
                fim = p.x + p.largura
            }
            if (linha.trim()) linhas.push(linha.replace(/\s+$/, ''))
        }
    }
    await pdf.destroy?.()
    return linhas
}

// ---------------- Leitura (puro: linhas → dados) ----------------
const normalLeitorRH = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const MESES_RH = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']

// "dd", "mm", "aaaa" → "aaaa-mm-dd" (só datas válidas).
function isoDeBrRH(dia, mes, ano) {
    const [d, m, a] = [Number(dia), Number(mes), Number(ano)]
    if (!(a >= 1990 && a <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
    const data = new Date(Date.UTC(a, m - 1, d))
    return data.getUTCDate() === d ? data.toISOString().slice(0, 10) : null
}
const datasDaLinhaRH = linha => [...String(linha).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map(m => isoDeBrRH(m[1], m[2], m[3])).filter(Boolean)

// Exames pelo nome (quando o ASO não traz o código eSocial). A ordem importa: psicossocial antes de clínico.
const EXAMES_POR_NOME_RH = [
    ['0281', /AUDIOMETRIA/], ['0296', /ACUIDADE/], ['0300', /PSICOSSOCIAL/], ['0530', /ELETROCARDIO|\bECG\b/],
    ['0536', /ELETROENCEFALO|\bEEG\b/], ['0658', /GLICEMIA|GLICOSE/], ['0693', /HEMOGRAMA/], ['1075', /\bRX\b|RAIO.?X/],
    ['0290', /ROMBERG/], ['0974', /PARASITOLOG/], ['1098', /URINA|\bEAS\b/], ['0295', /CLINIC|CONSULTA OCUPACIONAL/]
]
function codigoExameRH(codigo, descricao, catalogo = []) {
    if (codigo && (!catalogo.length || catalogo.some(c => String(c.id) === codigo))) return codigo
    const texto = normalLeitorRH(descricao)
    const porNome = EXAMES_POR_NOME_RH.find(([, regex]) => regex.test(texto))?.[0]
    if (porNome) return porNome
    const doCatalogo = catalogo.find(c => normalLeitorRH(c.nome) && texto.includes(normalLeitorRH(c.nome)))
    return doCatalogo ? String(doCatalogo.id) : null
}

function cpfDoTextoRH(linhas) {
    const texto = linhas.join('\n')
    const formatado = texto.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/)
    if (formatado) return formatado[0].replace(/\D/g, '')
    const solto = texto.match(/CPF[^\d\n]{0,12}(\d{11})\b/i)
    return solto ? solto[1] : null
}

// Nome da pessoa pelos rótulos de cada modelo (ASO, ficha, certificado).
function nomeDoTextoRH(linhas) {
    const limpar = t => String(t || '').replace(/\s{2,}.*$/, '').replace(/\s*-\s*CPF.*$/i, '')
        .replace(/[^A-Za-zÀ-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim()
    const rotulos = [/Atesto que o Sr\(?a?\)?\.?\s+(.+)/i, /Funcion[áa]rio\s*:\s*(.+?)(?:\s{2,}|Dt\.|$)/i, /^\s*Nome\s*:\s+(.+)/i,
        /NOME DO FUNC\s*:\s*(.+)/i, /^\s*NOME\s*:\s*(.+)/i]
    for (const linha of linhas)
        for (const r of rotulos) {
            const m = linha.match(r)
            if (m && limpar(m[1]).length > 5) return limpar(m[1])
        }
    const atestamos = linhas.findIndex(l => /ATESTAMOS QUE O SR/i.test(l))
    if (atestamos >= 0 && linhas[atestamos + 1]) return limpar(linhas[atestamos + 1])
    return null
}

// Data escrita por extenso: "03 de novembro de 2026".
function dataPorExtensoRH(linha) {
    const m = normalLeitorRH(linha).match(/(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/)
    if (!m) return null
    const mes = MESES_RH.indexOf(m[2]) + 1
    return mes ? isoDeBrRH(m[1], mes, m[3]) : null
}

function tipoDocumentoLidoRH(linhas) {
    const inicio = normalLeitorRH(linhas.slice(0, 6).join(' '))
    if (/ATESTADO DE SAUDE OCUPACIONAL/.test(inicio)) return 'ASO'
    if (/(\bEPI\b|E\.P\.I|EQUIPAMENTO DE PROTECAO)/.test(inicio) && linhas.some(l => /\bC\.?\s?A\.?(\s|$)/.test(l))) return 'FICHA DE EPI'
    if (/ORDEM DE SERVICO\s*-?\s*NR.?0?1\b/.test(normalLeitorRH(linhas.slice(0, 10).join(' ')))) return 'NR 01'
    // Certificado: o título do curso (depois de "Finalizou o curso", ou nas primeiras linhas).
    const curso = linhas.findIndex(l => /FINALIZOU O CURSO|CONCLUIU O CURSO|PARTICIPOU DO/i.test(l))
    const titulo = normalLeitorRH((curso >= 0 ? linhas.slice(curso + 1, curso + 4) : linhas.slice(0, 12)).join(' '))
    if (/TRABALHOS? EM ALTURA - MODELO|PLATAFORMA (DE TRABALHO )?AEREA|PLATAFORMAS? ELEVATORIA|\bPTA\b/.test(titulo)) return 'PTA'
    const nr = titulo.match(/\bNR\s*-?\s*0?(\d{1,2})\b/)
    if (nr) return { 1: 'NR 01', 5: 'NR 05 - CIPA', 6: 'NR 06 - EPI', 10: 'NR 10', 18: 'NR 18', 35: 'NR 35' }[Number(nr[1])] || `NR ${nr[1].padStart(2, '0')}`
    return null
}

// ASO: exames "data código - descrição" (CMV), "[ X ] descrição data" ou "data descrição", em duas colunas.
function lerAsoRH(linhas, catalogo = []) {
    const inicio = linhas.findIndex(l => /EXAMES?\s+(REALIZADOS|COMPLEMENTARES)|Exames Realizados/i.test(l))
    const fimRel = linhas.slice(inicio + 1).findIndex(l => /^\s*(Riscos|CONCLUS|Parecer|RESULTADO)/i.test(l))
    const trecho = inicio >= 0 ? linhas.slice(inicio + 1, fimRel >= 0 ? inicio + 1 + fimRel : undefined) : linhas
    const exames = new Map()
    const anotar = (codigo, descricao, data) => {
        const id = codigoExameRH(codigo, descricao, catalogo)
        if (id && data && (!exames.has(id) || exames.get(id).data < data)) exames.set(id, { codigo: id, descricao: descricao.trim(), data })
    }
    for (const linha of trecho) {
        if (/\[\s*X?\s*\]/i.test(linha)) {
            for (const m of linha.matchAll(/\[\s*X\s*\]\s*(.+?)\s+(\d{2})\/(\d{2})\/(\d{4})/gi))
                anotar(null, m[1], isoDeBrRH(m[2], m[3], m[4]))
            continue
        }
        for (const m of linha.matchAll(/(\d{2})\/(\d{2})\/(\d{4})\s+(?:(\d{4})\s*)?-?\s*(.+?)(?=\s+\d{2}\/\d{2}\/\d{4}|$)/g))
            anotar(m[4] || null, m[5], isoDeBrRH(m[1], m[2], m[3]))
    }
    const texto = normalLeitorRH(linhas.join(' '))
    const tipoExame = ['ADMISSIONAL', 'PERIODICO', 'DEMISSIONAL', 'RETORNO AO TRABALHO', 'MUDANCA DE FUNCAO', 'MUDANCA DE RISCO']
        .find(t => new RegExp(`\\b${t}\\b`).test(texto)) || null
    const resultado = /\(\s*X\s*\)\s*INAPTO\b|RESULTADO\s*:\s*INAPTO/.test(texto) ? 'INAPTO'
        : /\(\s*X\s*\)\s*APTO\b|RESULTADO\s*:\s*APTO|APTO PARA (A )?FUNCAO/.test(texto) ? 'APTO' : null
    const lista = [...exames.values()].sort((a, b) => a.codigo.localeCompare(b.codigo))
    // Data do ASO: a do exame clínico; sem ela, a mais recente dos exames; sem exames, "Dt. Exame".
    const dtExame = linhas.map(l => l.match(/Dt\.?\s*Exame\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)).find(Boolean)
    const data = exames.get('0295')?.data || lista.map(e => e.data).sort().pop() || (dtExame ? isoDeBrRH(dtExame[1], dtExame[2], dtExame[3]) : null)
    return { exames: lista, tipoExame: tipoExame ? tipoExame.replace('PERIODICO', 'PERIÓDICO') : null, resultado, data }
}

// EPI pelo nome (a palavra que importa) para casar com o catálogo, mesmo com outro CA.
const PALAVRAS_EPI_RH = [
    ['CAPACETE', /CAPACETE/], ['CINTO', /\bCINTO\b/], ['OCULOS', /OCULOS/], ['LUVA', /\bLUVAS?\b/], ['TOUCA', /TOUCA|BALACLAVA/],
    ['PROTETOR AUDITIVO', /PROTETOR AUDITIVO|ABAFADOR|PLUG/], ['BOTA', /\bBOTA|BOTINA|CALCADO|SAPATO/], ['TALABARTE', /TALABARTE/],
    ['TRAVA QUEDAS', /TRAVA.?QUEDA/], ['RESPIRADOR', /RESPIRADOR|MASCARA|\bPFF/], ['PROTETOR SOLAR', /PROTETOR SOLAR/], ['PROTETOR FACIAL', /PROTETOR FACIAL|VISEIRA/]
]
const palavraEpiRH = descricao => PALAVRAS_EPI_RH.find(([, r]) => r.test(normalLeitorRH(descricao)))?.[0] || null

// Ficha de EPI: em cada linha, a primeira data (entrega), a descrição e o CA (número de 3+ dígitos depois dela).
// Algumas fichas saem com a linha da tabela quebrada em duas ("23/10/2026   9722" e "1   14/08/2022   ÓCULOS"):
// a meia-linha "data + CA" é juntada com a seguinte.
function lerFichaEpiRH(linhas) {
    const juntas = []
    for (let i = 0; i < linhas.length; i++) {
        const meia = linhas[i].match(/^\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{3,6})\s*$/)
        const proxima = linhas[i + 1]
        if (meia && proxima && !/^\s*\d{2}\/\d{2}\/\d{4}/.test(proxima) && /[A-Za-zÀ-ÿ]{3}/.test(proxima)) {
            juntas.push(`${meia[1]}   ${proxima.trim()}   ${meia[2]}`)
            i++
        } else juntas.push(linhas[i])
    }
    const entregas = []
    for (const linha of juntas) {
        const data = datasDaLinhaRH(linha)[0]
        if (!data) continue
        const semDatas = linha.replace(/\d{2}\/\d{2,4}\/?\d{0,4}/g, '   ')
        // Descrição: palavras (números curtos como "Nº 41" e "PFF2" entram) até o primeiro número de 3+ dígitos.
        const descricao = semDatas.match(/[A-Za-zÀ-ÿ](?:[A-Za-zÀ-ÿ0-9º°.\/-]|\s(?!\s*\d{3,}\b))*/)
        const texto = descricao?.[0].replace(/^(PARES|PAR|UNID|UND|UN|PÇ|PC)\s+/i, '').replace(/\s+/g, ' ').trim()
        if (!texto || texto.length < 4 || /^(DATA|NOME|FUN[CÇ][AÃ]O|ASSINATURA|EMPRESA|DADOS|CPF|ITEM|INTEM)/i.test(texto)) continue
        const depois = semDatas.slice(descricao.index + descricao[0].length)
        const ca = depois.match(/(?:^|\s)(\d{3,6})(?=\s|$)/)?.[1] || null
        if (!ca && !palavraEpiRH(texto)) continue
        entregas.push({ data, descricao: texto, ca })
    }
    return { entregas, data: entregas.map(e => e.data).sort().pop() || null }
}

// Certificado: "Na(s) data(s) de: 15 a 19/06/2026" (vale o último dia, a conclusão: é o que o RH já lança),
// "Validade: 24 meses". Data por extenso só no fecho "Cidade, 03 de novembro de 2026" (o texto das
// ordens de serviço cita portarias "de 09 de março de 2020", que não são a data do documento).
function lerCertificadoRH(linhas) {
    const texto = linhas.join('\n')
    let data = null
    const periodo = texto.match(/data\(?s?\)?\s*(?:de)?\s*:\s*([^\n]+)/i)
    if (periodo) {
        const intervalo = periodo[1].match(/(\d{1,2})(?:\/(\d{1,2}))?\s*(?:a|à|e|até)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
        data = intervalo ? isoDeBrRH(intervalo[3], intervalo[4], intervalo[5]) : datasDaLinhaRH(periodo[1]).pop() || null
    }
    data ||= linhas.filter(l => /^\s*[A-Za-zÀ-ÿ /.-]{3,40},\s*\d{1,2}\s+de\s+/i.test(l)).map(dataPorExtensoRH).filter(Boolean).pop() || null
    const validade = texto.match(/Validade\s*:?\s*(\d{1,3})\s*(MESES|MES|ANOS?)/i)
    const validadeMeses = validade ? Number(validade[1]) * (/ANO/i.test(validade[2]) ? 12 : 1) : null
    return { data, validadeMeses }
}

// Tudo junto: tipo, pessoa e o conteúdo do tipo. catalogoExames = rh_exames (para o código pelo nome).
function lerDocumentoRH(linhas, catalogoExames = []) {
    const tipo = tipoDocumentoLidoRH(linhas)
    const base = { tipo, cpf: cpfDoTextoRH(linhas), nome: nomeDoTextoRH(linhas), temTexto: linhas.join('').replace(/\s/g, '').length > 200 }
    if (tipo === 'ASO') return { ...base, ...lerAsoRH(linhas, catalogoExames) }
    if (tipo === 'FICHA DE EPI') return { ...base, ...lerFichaEpiRH(linhas) }
    if (tipo) return { ...base, ...lerCertificadoRH(linhas) }
    return base
}

// ---------------- Do lido para a Ficha (puro) ----------------

// Pessoa do arquivo: pelo CPF; sem CPF, pelo nome (todas as palavras do nome mais curto no outro,
// primeiro nome igual: "VALDINEI DE FARIA LIMA" não casa com "VALDINEI DE FARIA ALMEIDA").
function pessoaDaLeituraRH(leitura, pessoas = []) {
    if (leitura?.cpf) {
        const porCpf = pessoas.find(p => String(p.cnpj || '').replace(/\D/g, '') === leitura.cpf)
        if (porCpf) return { pessoa: porCpf, por: 'CPF' }
    }
    const palavras = t => normalLeitorRH(t).split(/\s+/).filter(p => p.length > 2 && !['DOS', 'DAS', 'DES'].includes(p))
    const lido = palavras(leitura?.nome)
    if (lido.length < 2) return null
    const candidatos = pessoas.filter(p => {
        const cadastro = palavras(p.nome)
        if (!cadastro.length || cadastro[0] !== lido[0]) return false
        const [curto, longo] = lido.length <= cadastro.length ? [lido, cadastro] : [cadastro, lido]
        return curto.every(p => longo.includes(p))
    })
    return candidatos.length === 1 ? { pessoa: candidatos[0], por: 'nome' } : null
}

// EPI do catálogo para cada entrega: mesma palavra principal (capacete, luva…); entre vários, o do mesmo CA;
// um só candidato vale mesmo com outro CA (o CA do modelo muda com o tempo). Sem candidato: fora do catálogo.
function epiDoCatalogoRH(entrega, catalogo = []) {
    const palavra = palavraEpiRH(entrega.descricao)
    const candidatos = catalogo.filter(c => c.ativo !== false && palavra && palavraEpiRH(c.nome) === palavra)
    return candidatos.find(c => entrega.ca && String(c.ca) === String(entrega.ca)) || (candidatos.length === 1 ? candidatos[0] : null)
}

// Lançamentos que a leitura gera para a pessoa, sem repetir o que já existe (mesmo item e mesma data).
function planoLeituraRH(leitura, { funcionario, exames = [], epis = [], itens = [] }) {
    const plano = { novos: [], repetidos: 0, fora: [] }
    const somar = (data, dias) => {
        if (!Number(dias)) return null
        const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(dias)); return d.toISOString().slice(0, 10)
    }
    // Já lançado: mesma data de realização, ou (lançamento importado só com vencimento) o mesmo vencimento.
    const existe = (tipo, item, data) => {
        const prazo = (tipo === 'exame' ? exames : epis).find(c => String(c.id) === String(item))?.prazo_dias
        return itens.some(i => !i.excluido && String(i.funcionario) === String(funcionario) && i.tipo === tipo && String(i.item) === String(item)
            && (i.realizado === data || (!i.realizado && i.vencimento && i.vencimento === somar(data, prazo))))
    }
    if (leitura?.tipo === 'ASO') {
        for (const e of leitura.exames || []) {
            const item = exames.find(c => String(c.id) === e.codigo)
            if (!item) { plano.fora.push({ descricao: `${e.codigo} ${e.descricao}`, data: e.data }); continue }
            if (existe('exame', item.id, e.data)) { plano.repetidos++; continue }
            plano.novos.push({ tipo: 'exame', item: String(item.id), nome: item.nome, realizado: e.data, vencimento: somar(e.data, item.prazo_dias),
                obs: `Lido do ASO${leitura.tipoExame ? ` ${leitura.tipoExame.toLowerCase()}` : ''}` })
        }
    }
    if (leitura?.tipo === 'FICHA DE EPI') {
        const porItem = new Map()
        for (const entrega of leitura.entregas || []) {
            const item = epiDoCatalogoRH(entrega, epis)
            if (!item) { plano.fora.push(entrega); continue }
            const chave = `${item.id}|${entrega.data}`
            const atual = porItem.get(chave)
            // Duas entregas do mesmo item no mesmo dia (luva de segurança e luva de proteção): fica a do CA do catálogo.
            if (!atual || (String(entrega.ca) === String(item.ca) && String(atual.entrega.ca) !== String(item.ca))) porItem.set(chave, { item, entrega })
        }
        for (const { item, entrega } of porItem.values()) {
            if (existe('epi', item.id, entrega.data)) { plano.repetidos++; continue }
            plano.novos.push({ tipo: 'epi', item: String(item.id), nome: item.nome, realizado: entrega.data, vencimento: somar(entrega.data, item.prazo_dias),
                ca: entrega.ca || item.ca || null, obs: `Lido da ficha de EPI: ${entrega.descricao}` })
        }
    }
    return plano
}

// ---------------- No formulário de documento (js/rh.js → mostrarAnexoRH / salvarDocumento) ----------------
const pessoasLeituraRH = () => (typeof estadoRH !== 'undefined' ? estadoRH.pessoas : []) || []

async function analisarAnexoRH(input) {
    const arquivo = input?.files?.[0]
    const painel = input?.closest('.painel-padrao')
    painel?.querySelector('.rhl-linha')?.remove()
    if (input) input._leituraRH = null
    if (!arquivo || !painel || !(/\.pdf$/i.test(arquivo.name) || arquivo.type === 'application/pdf')) return

    const linha = document.createElement('div')
    linha.className = 'linha-padrao rhl-linha'
    linha.innerHTML = '<span style="text-align: left;">Lido do arquivo</span><div class="rhl-leitura"><small>Lendo o PDF…</small></div>'
    input.closest('.linha-padrao')?.after(linha)
    const caixa = linha.querySelector('.rhl-leitura')
    try {
        const pdfjs = await carregarPdfjsRH()
        if (!estadoFichaRH.exames.length && typeof carregarFichaRH === 'function') await carregarFichaRH().catch(() => {})
        const linhas = await linhasDoPdfRH(pdfjs, new Uint8Array(await arquivo.arrayBuffer()))
        if (input.files?.[0] !== arquivo) return
        const leitura = lerDocumentoRH(linhas, estadoFichaRH.exames)
        input._leituraRH = leitura
        if (!leitura.temTexto) return caixa.innerHTML = '<small>PDF escaneado (sem texto): preencha os campos à mão.</small>'
        if (!leitura.tipo) return caixa.innerHTML = '<small>Não reconheci o tipo deste documento: preencha os campos à mão.</small>'
        preencherFormularioLeituraRH(painel, leitura)
        caixa.innerHTML = painelLeituraRH(painel, leitura)
    } catch (erro) {
        console.error('[RH] leitura do PDF', erro)
        caixa.innerHTML = `<small>Não consegui ler o PDF (${escaparAtributo(erro.message || 'erro')}). Preencha à mão.</small>`
    }
}

// Preenche só o que está vazio: tipo, "Feito em" e funcionário.
function preencherFormularioLeituraRH(painel, leitura) {
    const doc = painel.querySelector('[name="doc"]')
    if (doc && !doc.id && leitura.tipo) { doc.id = leitura.tipo; doc.textContent = leitura.tipo }
    const realizado = painel.querySelector('[name="realizado"]')
    if (realizado && !realizado.value && leitura.data) realizado.value = leitura.data
    const funcionario = painel.querySelector('[name="funcionario"]')
    const achado = pessoaDaLeituraRH(leitura, pessoasLeituraRH())
    if (funcionario && !funcionario.id && achado) { funcionario.id = achado.pessoa.id; funcionario.textContent = achado.pessoa.nome }
}

function painelLeituraRH(painel, leitura) {
    const doc = painel.querySelector('[name="doc"]')?.id
    const funcionario = painel.querySelector('[name="funcionario"]')?.id
    const realizado = painel.querySelector('[name="realizado"]')?.value
    const achado = pessoaDaLeituraRH(leitura, pessoasLeituraRH())
    const avisos = []
    if (doc && doc !== leitura.tipo) avisos.push(`O arquivo parece ser <b>${escaparAtributo(leitura.tipo)}</b>, mas o tipo escolhido é ${escaparAtributo(doc)}.`)
    if (achado && funcionario && String(achado.pessoa.id) !== String(funcionario))
        avisos.push(`O arquivo é de <b>${escaparAtributo(achado.pessoa.nome)}</b> (pelo ${achado.por}), não do funcionário escolhido.`)
    // Só com a lista de funcionários carregada (tela do RH aberta); sem ela, não dá para afirmar.
    if (!achado && leitura.cpf && pessoasLeituraRH().length) avisos.push(`O CPF do arquivo não está em nenhum cadastro de funcionário${leitura.nome ? ` (${escaparAtributo(leitura.nome)})` : ''}.`)
    if (realizado && leitura.data && realizado !== leitura.data)
        avisos.push(`Data no arquivo: <b>${dataBRDeISO(leitura.data)}</b> (no formulário: ${dataBRDeISO(realizado)}).
            <button type="button" class="rhl-usar" onclick="this.closest('.painel-padrao').querySelector('[name=realizado]').value = '${leitura.data}'; this.remove()">Usar a do arquivo</button>`)
    const regra = { 'NR 10': 24, 'NR 35': 24, 'NR 18': 24, 'NR 06 - EPI': 12, PTA: 12 }[leitura.tipo]
    if (leitura.validadeMeses && regra && leitura.validadeMeses !== regra)
        avisos.push(`O certificado diz validade de ${leitura.validadeMeses} meses; o GCS conta ${regra} meses para ${escaparAtributo(leitura.tipo)}.`)

    const pessoaFicha = funcionario || achado?.pessoa?.id
    const plano = planoLeituraRH(leitura, { funcionario: pessoaFicha, exames: estadoFichaRH.exames, epis: estadoFichaRH.epis, itens: estadoFichaRH.itens })
    const detalhes = [
        leitura.tipo === 'ASO' ? [leitura.tipoExame, leitura.resultado].filter(Boolean).join(' · ') : '',
        leitura.validadeMeses ? `validade ${leitura.validadeMeses} meses` : '',
        leitura.data ? `${leitura.tipo === 'FICHA DE EPI' ? 'entrega' : 'data'} ${dataBRDeISO(leitura.data)}` : 'sem data no arquivo',
        achado ? `${escaparAtributo(achado.pessoa.nome)} (${achado.por} confere)` : leitura.nome ? escaparAtributo(leitura.nome) : ''
    ].filter(Boolean)
    const lista = plano.novos.map(n => `<li>${n.tipo === 'epi' ? `CA ${escaparAtributo(n.ca || '—')}` : escaparAtributo(n.item)} · ${escaparAtributo(n.nome)} · ${dataBRDeISO(n.realizado)} → vence ${n.vencimento ? dataBRDeISO(n.vencimento) : '—'}</li>`).join('')
    const fora = plano.fora.map(f => `<li>${escaparAtributo(f.descricao)}${f.ca ? ` (CA ${escaparAtributo(f.ca)})` : ''}</li>`).join('')
    const podeCatalogo = typeof EDITAM_CATALOGO_RH !== 'undefined' && EDITAM_CATALOGO_RH.includes(acesso?.permissao)
    return `
        <div class="rhl-cabecalho"><b>${escaparAtributo(leitura.tipo)}</b> ${detalhes.map(d => `<span>${d}</span>`).join('')}</div>
        ${avisos.map(a => `<div class="rhl-aviso">${a}</div>`).join('')}
        ${plano.novos.length ? `
            <label class="rhl-aplicar"><input type="checkbox" name="aplicarLeitura" ${avisos.some(a => a.includes('não do funcionário')) ? '' : 'checked'}>
                Ao salvar, lançar ${plano.novos.length} ${leitura.tipo === 'ASO' ? 'exame(s)' : 'entrega(s) de EPI'} na Ficha</label>
            <ul class="rhl-lista">${lista}</ul>` : ''}
        ${plano.repetidos ? `<small>${plano.repetidos} já estavam lançado(s) na Ficha com a mesma data.</small>` : ''}
        ${fora ? `<details class="rhl-fora"><summary>${plano.fora.length} item(ns) fora do catálogo da Ficha</summary><ul class="rhl-lista">${fora}</ul>
            ${leitura.tipo === 'FICHA DE EPI' && podeCatalogo ? '<label><input type="checkbox" name="catalogarLeitura"> Incluir no catálogo de EPIs (sem tornar obrigatório) e lançar</label>' : ''}</details>` : ''}`
}

// Depois de salvar o documento: lança na Ficha o que o painel mostrou (se marcado).
async function aplicarLeituraRH(input, funcionario) {
    const leitura = input?._leituraRH
    const painel = input?.closest('.painel-padrao')
    if (!leitura || !funcionario || !painel?.querySelector('[name="aplicarLeitura"]:checked, [name="catalogarLeitura"]:checked')) return null
    const aplicar = !!painel.querySelector('[name="aplicarLeitura"]:checked')
    const catalogar = !!painel.querySelector('[name="catalogarLeitura"]:checked')
    const resumo = { lancados: 0, catalogados: 0, falhas: 0 }

    if (catalogar && leitura.tipo === 'FICHA DE EPI') {
        const novos = new Map()
        for (const entrega of planoLeituraRH(leitura, { funcionario, exames: [], epis: estadoFichaRH.epis, itens: [] }).fora) {
            const chave = palavraEpiRH(entrega.descricao) || normalLeitorRH(entrega.descricao)
            if (!novos.has(chave)) novos.set(chave, entrega)
        }
        for (const entrega of novos.values()) {
            const nome = entrega.descricao.charAt(0) + entrega.descricao.slice(1).toLowerCase()
            const registro = { id: `epi-${crypto.randomUUID().slice(0, 8)}`, nome, ca: entrega.ca || null, prazo_dias: 180, exigencias: [], ambientes: [], exceto_cargos: [],
                ordem: 50 + estadoFichaRH.epis.length, ativo: true, usuario: acesso.usuario }
            const resposta = await enviar(`rh_epis/${registro.id}`, registro)
            if (resposta?.success) { estadoFichaRH.epis.push(registro); resumo.catalogados++ } else resumo.falhas++
        }
    }

    if (aplicar || catalogar) {
        const plano = planoLeituraRH(leitura, { funcionario, exames: estadoFichaRH.exames, epis: estadoFichaRH.epis, itens: estadoFichaRH.itens })
        for (const novo of plano.novos) {
            const registro = { id: crypto.randomUUID(), funcionario: Number(funcionario), tipo: novo.tipo, item: novo.item, realizado: novo.realizado,
                vencimento: novo.vencimento, obs: novo.obs, ...(novo.tipo === 'epi' ? { ca: novo.ca } : {}), usuario: acesso.usuario }
            const resposta = await enviar(`rh_ficha_itens/${registro.id}`, registro)
            if (resposta?.success) { estadoFichaRH.itens.push({ ...registro, timestamp: Date.now() }); resumo.lancados++ } else resumo.falhas++
        }
    }
    return resumo
}
