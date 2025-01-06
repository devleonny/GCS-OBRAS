var lista = [
    'cliente_selecionado',
    'estado',
    'cep',
    'bairro',
    'cidade',
    'cnpj',
    'contrato',
    'analista',
    'email_analista',
    'telefone_analista',
    'vendedor',
    'email_vendedor',
    'telefone_vendedor',
    'consideracoes',
    'tipo_de_frete',
    'condicoes',
    'garantia'
];

var dados_clientes_provisorios = {}

// Processos para inicialização;
vendedores_analistas()
carregar_pagamentos()
carregar_datalist_clientes()
recuperar_preenchido()

async function carregar_datalist_clientes() {

    var dados_clientes = {}
    if (Object.keys(dados_clientes_provisorios).length > 0) {
        dados_clientes = dados_clientes_provisorios

    } else {
        dados_clientes = await recuperarDados('dados_clientes') || {};
    }

    var items = []

    for (cliente in dados_clientes) {
        var dados = dados_clientes[cliente]

        items.push(dados.nome)
    }

    var cliente_selecionado = document.getElementById('cliente_selecionado');
    var suggestions = document.getElementById('suggestions');

    cliente_selecionado.addEventListener('input', function () {
        var query = String(cliente_selecionado.value).toUpperCase()
        suggestions.innerHTML = '';

        if (query === '') return;

        var filtrados = []

        items.forEach(it => {
            if (String(it).includes(query)) {
                filtrados.push(it)
            }
        })

        filtrados.forEach(item => {
            var div = document.createElement('div');
            div.textContent = item;
            div.classList.add('autocomplete-item');
            div.addEventListener('click', function () {
                cliente_selecionado.value = item;
                suggestions.innerHTML = '';
                preencher('cliente_selecionado')
            });
            suggestions.appendChild(div);
        });
    });

    document.addEventListener('click', function (event) {
        if (!document.querySelector('.autocomplete-container').contains(event.target)) {
            suggestions.innerHTML = '';
        }
    });
}

function limpar_campos() {
    openPopup_v2('Limpar os campos?', true, `executar_limpar_campos()`)
}

function executar_limpar_campos() {

    document.getElementById('cnpj').value = ''
    document.getElementById('cliente_selecionado').value = ''
    document.getElementById('consideracoes').value = ''
    document.getElementById('tipo_de_frete').value = ''
    document.getElementById('transportadora').value = ''

    salvar_preenchido()
    remover_popup()
}

function carregar_pagamentos() {
    var dados_pagamentos = JSON.parse(localStorage.getItem('dados_pagamentos'))
    var condicoes = document.getElementById('condicoes')

    dados_pagamentos.forEach(function (item) {
        var option = document.createElement('option')
        option.textContent = item
        condicoes.appendChild(option)
    })
}


function toggleTabela() {
    var tabela = document.getElementById('tabela_dados_cliente');
    tabela.classList.toggle('show');

    if (tabela.classList.contains('show')) {
        menu_inferior.style.display = 'none'
        overlay.style.display = 'block';
    } else {
        menu_inferior.style.display = 'flex'
        overlay.style.display = 'none';
    }
}

function pagina_adicionar() {
    salvar_preenchido()
    window.location.href = 'adicionar.html'
}

function vendedores_analistas() {
    var dados_vendedores = JSON.parse(localStorage.getItem('vendedores')) || {}
    var vendedores = Object.keys(dados_vendedores)

    var select = document.getElementById('vendedor')

    select.addEventListener('change', function () {
        atualizar_dados_vendedores()
        salvar_preenchido()
    })

    vendedores.forEach(function (vend_) {
        var option = document.createElement('option')
        option.textContent = vend_
        select.appendChild(option)
    })

    var dados_acesso = JSON.parse(localStorage.getItem('acesso'))

    document.getElementById('analista').textContent = dados_acesso.nome_completo
    document.getElementById('email_analista').textContent = dados_acesso.email
    document.getElementById('telefone_analista').textContent = dados_acesso.telefone

    atualizar_dados_vendedores()

}

function atualizar_dados_vendedores() {

    var dados_vendedores = JSON.parse(localStorage.getItem('vendedores'))
    var vendedor = document.getElementById('vendedor').value
    document.getElementById('email_vendedor').textContent = dados_vendedores[vendedor]['email']
    document.getElementById('telefone_vendedor').textContent = dados_vendedores[vendedor]['telefone']

}

function incluir_listeners() {

    lista.forEach(function (item) {
        document.getElementById(item).addEventListener('input', function () {
            salvar_preenchido()
            total()
        })
    })
}

function salvar_preenchido() {

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (orcamento_v2.lpu_ativa == 'MODALIDADE LIVRE') {
        total_v2()
    } else {
        total()
    }

    var chamado_off = document.getElementById('chamado_off')

    if (chamado_off.checked) {
        document.getElementById('contrato').style.display = 'none'
        document.getElementById('contrato').value = ''
    } else {
        document.getElementById('contrato').style.display = 'block'
    }

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    var dados_analista = {
        email: document.getElementById('email_analista').textContent,
        nome: document.getElementById('analista').textContent,
        telefone: document.getElementById('telefone_analista').textContent
    }

    if (orcamento_v2.id) {
        dados_analista.email = orcamento_v2.dados_orcam.email_analista
        dados_analista.telefone = orcamento_v2.dados_orcam.telefone_analista
        dados_analista.nome = orcamento_v2.dados_orcam.analista
    }

    orcamento_v2.dados_orcam = {
        analista: dados_analista.nome,
        estado: document.getElementById('estado').textContent,
        bairro: document.getElementById('bairro').textContent,
        cep: document.getElementById('cep').textContent,
        cidade: document.getElementById('cidade').textContent,
        cliente_selecionado: document.getElementById('cliente_selecionado').value,
        cnpj: document.getElementById('cnpj').value,
        condicoes: document.getElementById('condicoes').value,
        consideracoes: document.getElementById('consideracoes').value,
        contrato: chamado_off.checked ? 'sequencial' : document.getElementById('contrato').value,
        data: new Date(),
        email_analista: dados_analista.email,
        email_vendedor: document.getElementById('email_vendedor').textContent,
        garantia: document.getElementById('garantia').value,
        telefone_analista: dados_analista.telefone,
        telefone_vendedor: document.getElementById('telefone_vendedor').textContent,
        tipo_de_frete: document.getElementById('tipo_de_frete').value,
        vendedor: document.getElementById('vendedor').value,
    }

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));

}

function tipo_elemento(element) {
    if ('value' in element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT')) {
        return 'value';
    }
    return 'textContent';
}


function recuperar_preenchido() {

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    var dados_orcam = orcamento_v2.dados_orcam || {}

    if (dados_orcam.contrato == 'sequencial') {
        document.getElementById('chamado_off').checked = true
        document.getElementById('contrato').style.display = 'none'
    } else {
        document.getElementById('chamado_off').checked = false
        document.getElementById('contrato').style.display = 'block'
    }

    for (chave in dados_orcam) {

        var info = dados_orcam[chave]

        if (document.getElementById(chave)) {
            var elemento = document.getElementById(chave)
            if (tipo_elemento(elemento) == 'value') {
                elemento.value = info
            } else {
                elemento.textContent = info
            }
        }

    }

    var levantamentos = document.getElementById('levantamentos')
    if (orcamento_v2.levantamentos && levantamentos) {
        var acumulado = ''

        for (chave in orcamento_v2.levantamentos) {
            var levantamento = orcamento_v2.levantamentos[chave]

            var imagem = ''

            if (formato(levantamento.formato) == 'PDF') {
                imagem = 'pdf'
            } else if (formato(levantamento.formato) == 'IMAGEM') {
                imagem = 'imagem'
            } else if (formato(levantamento.formato) == 'PLANILHA') {
                imagem = 'excel2'
            } else {
                imagem = 'anexo'
            }

            acumulado += `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <div style="align-items: center; width: max-content; font-size: 0.7em; display: flex; justify-content; left; box-shadow: 2px 2px #94a0ab; background-color: #e9e9e9; color: #555; padding: 5px; margin:5px; border-radius: 5px;">
                    <img src="${imagem}.png" style="width: 3vw;">
                    <label><strong>${encurtar_texto(levantamento.nome, 10)}</strong></label>
                </div>
                <label style="text-decoration: underline; font-size: 0.7em; cursor: pointer;" onclick="excluir_levantamento('${chave}')">Excluir</label>
            </div>
            `
        }

        levantamentos.innerHTML = acumulado
    }

}

function excluir_levantamento(chave) {
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (orcamento_v2.levantamentos) {

        delete orcamento_v2.levantamentos[chave]

        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

        recuperar_preenchido()

    }
}

function formatarCEP(cep) {
    cep = String(cep);
    cep = cep.replace(/\D/g, '');
    cep = cep.replace(/^(\d{5})(\d{3})/, '$1-$2');
    return cep;
}

function formatarCNPJ_CPF(documento) {
    documento = documento.replace(/\D/g, '');

    if (documento.length === 11) {
        return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    } else if (documento.length === 14) {
        return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

    } else {
        return 0;
    }
}

async function preencher(campo) {

    var dados_clientes = {}
    var dados_com_chave_nome = {}
    var termo = document.getElementById(campo).value

    if (Object.keys(dados_clientes_provisorios).length > 0) {
        dados_clientes = dados_clientes_provisorios

    } else {
        dados_clientes = await recuperarDados('dados_clientes') || {};
    }

    if (campo == 'cliente_selecionado') {

        for (cnpj in dados_clientes) {
            var infos = dados_clientes[cnpj]
            dados_com_chave_nome[infos.nome] = infos
        }
        dados_clientes = dados_com_chave_nome
    } else {
        termo = formatarCNPJ_CPF(termo)
    }

    var lista = ['estado', 'cep', 'bairro', 'cidade']

    if (dados_clientes[termo]) {

        if (campo == 'cnpj') {
            document.getElementById('cliente_selecionado').value = dados_clientes[termo].nome

        } else if (campo == 'cliente_selecionado') {
            document.getElementById('cnpj').value = dados_clientes[termo]?.cnpj || ''
        }

        lista.forEach(item => {

            document.getElementById(item).textContent = dados_clientes[termo][item]

        })

    } else {

        if (campo == 'cnpj') {
            document.getElementById('cliente_selecionado').value = ''

        } else if (campo == 'cliente_selecionado') {
            document.getElementById('cnpj').value = dados_clientes[termo]?.cnpj || ''
        }

        lista.forEach(item => {

            document.getElementById(item).textContent = 'Preencha o CNPJ ou Nome do Cliente'

        })
    }

    salvar_preenchido()
    total()

}