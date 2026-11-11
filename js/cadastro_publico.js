// Página pública de cadastro (cadastro.html?t=TOKEN). Sem login: o token do link é a autorização.
// O servidor (SCRIPTS/cadastro_publico.js) diz se o link ainda vale e por quantos segundos;
// ao enviar, cria o cadastro em clientes e o link deixa de valer.
(() => {
    const api = 'https://api.gcs.app.br'
    // O código sai da barra de endereço, mas fica guardado só nesta aba: recarregar a página
    // continua funcionando e, ao fechar a aba, ele some.
    const lerSessao = () => { try { return sessionStorage.getItem('cp_token') || '' } catch { return '' } }
    const gravarSessao = valor => { try { valor ? sessionStorage.setItem('cp_token', valor) : sessionStorage.removeItem('cp_token') } catch { } }
    const token = new URLSearchParams(location.search).get('t') || lerSessao()
    gravarSessao(token)
    const estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
        'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

    const form = document.getElementById('cp-form')
    const aviso = document.getElementById('cp-aviso')
    const tempo = document.getElementById('cp-tempo')
    const erro = document.getElementById('cp-erro')
    const campo = nome => form.elements[nome]
    let fimEm = 0
    let relogio = null

    // Some com o token da barra de endereço (não fica no histórico nem em print).
    if (token) history.replaceState(null, '', location.pathname)

    campo('estado').insertAdjacentHTML('beforeend', estados.map(uf => `<option>${uf}</option>`).join(''))

    async function post(rota, corpo) {
        const resposta = await fetch(`${api}/cadastro-publico/${rota}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo)
        })
        const retorno = await resposta.json().catch(() => ({}))
        return { ...retorno, ok: resposta.ok, status: resposta.status }
    }

    function encerrar(mensagem, sucesso = false, manterCodigo = false) {
        clearInterval(relogio)
        if (!manterCodigo) gravarSessao('')
        form.hidden = true
        tempo.hidden = true
        aviso.hidden = false
        aviso.classList.toggle('ok', sucesso)
        aviso.textContent = mensagem
    }

    function tic() {
        const resta = Math.max(0, Math.round((fimEm - Date.now()) / 1000))
        if (!resta) return encerrar('Este link expirou. Peça um novo link a quem enviou.')
        const m = String(Math.floor(resta / 60)).padStart(2, '0')
        const s = String(resta % 60).padStart(2, '0')
        tempo.textContent = `Link válido por mais ${m}:${s}`
        tempo.classList.toggle('acabando', resta <= 120)
    }

    async function iniciar() {
        if (!token) return encerrar('Link inválido.')
        try {
            const { valido, segundos, motivo } = await post('consultar', { token })
            if (!valido) return encerrar(motivo || 'Este link não vale mais.')
            fimEm = Date.now() + segundos * 1000
            aviso.hidden = true
            form.hidden = false
            tempo.hidden = false
            tic()
            relogio = setInterval(tic, 1000)
        } catch {
            encerrar('Não foi possível verificar o link. Confira sua internet e recarregue a página.', false, true)
        }
    }

    // ---- máscaras
    const so = (v, n) => v.replace(/\D/g, '').slice(0, n)
    campo('cpf').addEventListener('input', e => {
        e.target.value = so(e.target.value, 11)
            .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    })
    campo('telefone').addEventListener('input', e => {
        const d = so(e.target.value, 11)
        e.target.value = d.length > 10
            ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
            : d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? '-' + c : ''}`)
        if (!d) e.target.value = ''
    })
    campo('cep').addEventListener('input', async e => {
        const d = so(e.target.value, 8)
        e.target.value = d.replace(/(\d{5})(\d)/, '$1-$2')
        if (d.length !== 8) return
        try {
            const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${d}`)
            if (!r.ok) return
            const { state, city, street, neighborhood } = await r.json()
            if (state) { campo('estado').value = state; carregarCidades(state) }
            if (city) campo('cidade').value = city
            if (street && !campo('endereco').value) campo('endereco').value = street
            if (neighborhood && !campo('bairro').value) campo('bairro').value = neighborhood
        } catch { /* sem CEP automático: preenche à mão */ }
    })

    async function carregarCidades(uf) {
        const lista = document.getElementById('cp-cidades')
        lista.innerHTML = ''
        if (!uf) return
        try {
            const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
            const cidades = await r.json()
            lista.innerHTML = cidades.map(c => `<option value="${c.nome}">`).join('')
        } catch { /* segue com texto livre */ }
    }
    campo('estado').addEventListener('change', e => carregarCidades(e.target.value))

    // ---- validação
    function cpfValido(cpf) {
        const d = cpf.replace(/\D/g, '')
        if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
        for (const n of [9, 10]) {
            let soma = 0
            for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
            if ((soma * 10) % 11 % 10 !== Number(d[n])) return false
        }
        return true
    }

    function coletar() {
        const valor = n => String(campo(n)?.value || '').trim()
        const radio = n => form.querySelector(`[name="${n}"]:checked`)?.value || ''
        return {
            nome: valor('nome'), chave_pix: valor('chave_pix'), cpf: valor('cpf'), estado: valor('estado'),
            endereco: valor('endereco'), bairro: valor('bairro'), cidade: valor('cidade'), cep: valor('cep'),
            telefone: valor('telefone'), email: valor('email'),
            cracha: radio('cracha'), contrato: radio('contrato'), kit: radio('kit'),
            aceite_termo: campo('aceite_termo').checked
        }
    }

    function validar(d) {
        const problemas = []
        const marcar = (nome, ruim, msg) => {
            campo(nome)?.classList?.toggle('invalido', ruim)
            if (ruim) problemas.push(msg)
        }
        marcar('nome', d.nome.split(/\s+/).length < 2, 'Informe o nome completo.')
        marcar('chave_pix', !d.chave_pix, 'Informe a chave Pix.')
        marcar('cpf', !cpfValido(d.cpf), 'CPF inválido.')
        marcar('cep', d.cep.replace(/\D/g, '').length !== 8, 'CEP inválido.')
        marcar('estado', !d.estado, 'Selecione o estado.')
        marcar('cidade', !d.cidade, 'Informe a cidade.')
        marcar('endereco', !d.endereco, 'Informe o endereço.')
        marcar('telefone', ![10, 11].includes(d.telefone.replace(/\D/g, '').length), 'Telefone inválido.')
        marcar('email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email), 'E-mail inválido.')
        if (!d.cracha || !d.contrato || !d.kit) problemas.push('Responda as três perguntas de Sim/Não.')
        campo('aceite_termo').closest('label').classList.toggle('invalido', !d.aceite_termo)
        if (!d.aceite_termo) problemas.push('É preciso ler e concordar com o Padrão de Atendimento.')
        return problemas
    }

    form.addEventListener('submit', async e => {
        e.preventDefault()
        const dados = coletar()
        const problemas = validar(dados)
        erro.hidden = !problemas.length
        erro.textContent = problemas.join(' ')
        if (problemas.length) return form.querySelector('.invalido')?.focus()

        const botao = form.querySelector('button[type=submit]')
        botao.disabled = true
        botao.textContent = 'Enviando…'
        try {
            const r = await post('enviar', { token, dados })
            if (r.ok) return encerrar(r.atualizado
                ? 'Seus dados foram atualizados com sucesso. Obrigado! Você já pode fechar esta página.'
                : 'Cadastro enviado com sucesso. Obrigado! Você já pode fechar esta página.', true)
            if (r.status === 410) return encerrar(r.mensagem || 'Este link não vale mais.')
            erro.hidden = false
            erro.textContent = r.mensagem || 'Não foi possível enviar. Tente de novo.'
        } catch {
            erro.hidden = false
            erro.textContent = 'Sem conexão com o servidor. Confira sua internet e tente de novo.'
        } finally {
            botao.disabled = false
            botao.textContent = 'Enviar cadastro'
        }
    })

    iniciar()
})()
