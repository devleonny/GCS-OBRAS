let omie_cliente = {};
let omie_categorias = {};
let omie_departamentos = {};

atualizar()

document.getElementById('campo-pesquisa').addEventListener('keydown', function (event) {

    if (event.key === 'Enter') {

        let termo = document.getElementById('campo-pesquisa').value
        pesquisar_pagamento()
        event.preventDefault();

    }

})

async function botao_cadastrar_cliente() {
    
    let botao_cadastrar_cliente = document.getElementById('botao_cadastrar_cliente')
    let cnpj_cpf = document.getElementById('cnpj_cpf')
    let nome = document.getElementById('cliente_pagamento')
    let regex = /Id \[(\d+)\]/;
    let dados_clientes = JSON.parse(localStorage.getItem('dados_clientes'))
    let novo_intervalo_cod_cliente = {}

    let container_cnpj_cpf = document.getElementById('container_cnpj_cpf')
    let loading_cliente = document.getElementById('loading_cliente')

    loading_cliente.style.display = ''
    botao_cadastrar_cliente.style.display = 'none'

    for (let cliente in dados_clientes) {

        novo_intervalo_cod_cliente[dados_clientes[cliente].omie] = cliente

    }

    if (nome.value && cnpj_cpf.value) {

        await cadastrarCliente(nome.value, cnpj_cpf.value)

        let resposta_cliente_cadastrado = JSON.parse(localStorage.getItem('resposta_cliente_cadastrado'))

        if (resposta_cliente_cadastrado.cod_status == 0) {

            dados_clientes[nome.value] = {

                'cnpj': cnpj_cpf.value,
                'omie': resposta_cliente_cadastrado.codigo_cliente_omie

            }

            localStorage.setItem('dados_clientes', JSON.stringify(dados_clientes))

            container_cnpj_cpf.style.display = 'none'
            cnpj_cpf.innerHTML = ''

        } else if (resposta_cliente_cadastrado.cod_status == 4) {

            let match = resposta_cliente_cadastrado.status.match(regex);

            if (match) {

                let id_cliente = match[1]
                nome.value = novo_intervalo_cod_cliente[id_cliente]
                cnpj_cpf.innerHTML = ''
                container_cnpj_cpf.style.display = 'none'

            } else {

                console.log(resposta_cliente_cadastrado.status)
                cnpj_cpf.style.backgroundColor = 'B12425'

            }

        } else {

            console.log(resposta_cliente_cadastrado.status)
            cnpj_cpf.style.backgroundColor = 'B12425'

        }

    } else {

        openPopup('Preencha o CNPJ/CPF e o nome do Cliente/Prestador')

    }

    loading_cliente.style.display = 'none'
    botao_cadastrar_cliente.style.display = ''

}

document.getElementById('B_add_departamento').addEventListener('click', function () {

    add_categoria_departamento('departamento')
    total_pagamento('departamento')

})

document.getElementById('B_add_categoria').addEventListener('click', function () {

    add_categoria_departamento('categoria')
    total_pagamento('categoria')

})

function abrir_pagamentos(add) {

    document.getElementById('formulario_pagamento').style.display = 'block'
    document.getElementById('container_categoria').innerHTML = ''
    document.getElementById('container_departamento').innerHTML = ''
    document.getElementById('container_anexos').innerHTML = ''
    document.getElementById('clientes').innerHTML = ''
    buscar_datalists('clientes', 'clientes')
    document.getElementById('cnpj_cpf').innerHTML = ''

    document.getElementById('cliente_pagamento').addEventListener('change', function () {

        let dados_clientes = JSON.parse(localStorage.getItem('dados_clientes'))
        let container_cnpj_cpf = document.getElementById('container_cnpj_cpf')

        if (!dados_clientes[this.value]) {

            container_cnpj_cpf.style.display = ''

        } else {

            container_cnpj_cpf.style.display = 'none'

        }

    })

    document.getElementById('valor_pagamento').addEventListener('change', function () {

        total_pagamento('categoria')
        total_pagamento('departamento')

    })

    localStorage.setItem('editar_pagamento', unicoID())

    if (add) {

        add_categoria_departamento('categoria')
        add_categoria_departamento('departamento')

    }

    total_pagamento()

}

function criar_arrays() {

    omie_cliente = {};
    omie_categorias = {};
    omie_departamentos = {};

    let dados_clientes = JSON.parse(localStorage.getItem('dados_clientes'));

    for (let cliente in dados_clientes) {

        omie_cliente[dados_clientes[cliente].omie] = cliente;

    }

    let dados_departamentos = JSON.parse(localStorage.getItem('dados_departamentos'));

    for (let departamento in dados_departamentos) {

        omie_departamentos[dados_departamentos[departamento]] = departamento;

    }

    let dados_categorias = JSON.parse(localStorage.getItem('dados_categorias'));

    for (let categoria in dados_categorias) {

        omie_categorias[dados_categorias[categoria]] = categoria;

    }

}

async function atualizar() {

    criar_arrays()

    document.getElementById('loading').style = "display: flex; justify-content: center; align-items: center;"
    document.getElementById('tabela').style.display = 'none'
    document.getElementById('menu_top').style.display = 'none'

    await obter_lista_pagamentos();

    console.log()

    buscar_pagamentos()
    document.getElementById('loading').style.display = 'none'
    document.getElementById('tabela').style.display = ''
    document.getElementById('menu_top').style.display = ''

}

function pesquisar_pagamento() {

    let termo = String(document.getElementById('campo-pesquisa').value).toLowerCase()
    buscar_pagamentos(termo)

}

function buscar_pagamentos(termo) {

    let lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos'));

    let acesso = JSON.parse(localStorage.getItem('acesso'));

    let listagem = document.getElementById('listagem');
    listagem.innerHTML = '';

    for (let pagamento in lista_pagamentos) {

        let textos = [];

        let pagamentoDetalhes = lista_pagamentos[pagamento].param[0];

        let categorias = pagamentoDetalhes.categorias.map(function (cat, index) {

            return (index + 1) + ". " + (omie_categorias[cat.codigo_categoria] || 'Cat. Desat.');

        }).join("<br>");

        let departamentos = pagamentoDetalhes.distribuicao.map(function (dep, index) {

            return (index + 1) + ". " + (omie_departamentos[dep.cCodDep] || 'Dep. Desat.');

        }).join("<br>");

        let beneficiario = omie_cliente[pagamentoDetalhes.codigo_cliente_fornecedor];
        let observacao = String(pagamentoDetalhes.observacao).replace(/\n/g, '<br>');
        let valor = pagamentoDetalhes.valor_documento;
        let data = pagamentoDetalhes.data_vencimento;
        let criado = lista_pagamentos[pagamento].criado;
        let aprovado = lista_pagamentos[pagamento].aprovado;
        let cod_status = lista_pagamentos[pagamento].cod_status
        let status = lista_pagamentos[pagamento].status
        let data_registro = lista_pagamentos[pagamento].data_registro

        let tr = document.createElement('tr');

        let label_departamentos = document.createElement('td');
        let label_categorias = document.createElement('td');
        let label_beneficiario = document.createElement('td');
        let label_observacao = document.createElement('td');
        let label_valor = document.createElement('td');
        let label_data = document.createElement('td');
        let label_criado = document.createElement('td');
        let label_aprovado = document.createElement('td');
        let label_status = document.createElement('td');
        let label_data_registro = document.createElement('td');
        let label_aprov = document.createElement('td');


        let anexos = lista_pagamentos[pagamento].anexos;
        let label_anexos = document.createElement('td');
        label_anexos.style.textAlign = 'center'
        let img_anexos = document.createElement('img')
        img_anexos.src = "/imagens/anexo.png"
        img_anexos.style.width = '25px'

        img_anexos.addEventListener('click', function () {

            abrir_anexos(anexos)

        })
        if (anexos.length != 0) {

            label_anexos.appendChild(img_anexos)

        }

        let button_aprov = document.createElement('button');
        button_aprov.textContent = 'Aprovar';
        button_aprov.classList.add('bot_aprovar');

        button_aprov.dataset.pagamento = pagamento;

        button_aprov.addEventListener('click', function (event) {

            let pagamento = event.target.dataset.pagamento;
            let lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos'));

            let usuario = JSON.parse(localStorage.getItem('acesso')).usuario;

            lista_pagamentos[pagamento].aprovado = usuario;

            lista_pagamentos[pagamento].cod_status = 3

            localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos));

            aprovarPagamento(lista_pagamentos[pagamento].param);
            enviar_lista_pagamentos();
            buscar_pagamentos();

        });


        label_aprov.appendChild(button_aprov);

        label_departamentos.innerHTML = departamentos;
        label_categorias.innerHTML = categorias;
        label_beneficiario.textContent = beneficiario;
        label_observacao.innerHTML = observacao;
        label_valor.textContent = dinheiro(conversor(valor));
        label_data.textContent = data;
        label_criado.textContent = criado;
        label_aprovado.textContent = aprovado;
        label_status.textContent = status
        label_data_registro.textContent = data_registro

        textos.push(String(departamentos).toLowerCase());
        textos.push(String(categorias).toLowerCase());
        textos.push(String(beneficiario).toLowerCase());
        textos.push(String(observacao).toLowerCase());
        textos.push(String(data).toLowerCase());
        textos.push(String(criado).toLowerCase());
        textos.push(String(aprovado).toLowerCase());

        let label_excluir = document.createElement('td');
        let img_excluir = document.createElement('img');
        img_excluir.src = "/imagens/excluir.png";
        img_excluir.style.width = '25px';
        label_excluir.style.textAlign = 'center'
        label_excluir.appendChild(img_excluir);

        label_excluir.addEventListener('click', function () {
            apagarPagamento_sistema(pagamento);
            enviar_lista_pagamentos();
            buscar_pagamentos();
        });

        let label_editar = document.createElement('td');

        let img_editar = document.createElement('img');
        img_editar.src = "/imagens/editar.png";
        img_editar.style.width = '25px';
        label_editar.style.textAlign = 'center'
        label_editar.appendChild(img_editar);

        label_editar.addEventListener('click', function () {
            editarPagamento_sistema(pagamento);
        });

        let label_ok = document.createElement('td');
        label_ok.textContent = 'Ativo no Omie'

        let label_atualizar = document.createElement('td');
        let texto_atualiza = document.createElement('label')
        texto_atualiza.textContent = 'Atualize a página'
        texto_atualiza.classList = 'atualize'
        label_atualizar.appendChild(texto_atualiza)

        let label_exclusao_falhou = document.createElement('td');
        label_exclusao_falhou.textContent = 'Falha na Exclusão'

        let label_nao_pode_editar = document.createElement('td')
        label_nao_pode_editar.textContent = '--'

        let adicionarLinha = textos.some(function (item) {

            return termo === undefined || item.includes(String(termo).toLowerCase());

        });

        if (termo == undefined || termo == '') {

            document.getElementById('tabela').style.backgroundColor = '#222'

        }

        if (termo == 'Aprovados') {

            if (cod_status == 1) {

                adicionarLinha = true
                document.getElementById('tabela').style.backgroundColor = '#097fe6'

            } else {

                adicionarLinha = false

            }
        } else if (termo == 'Aguardando') {

            if (cod_status != 1) {

                adicionarLinha = true
                document.getElementById('tabela').style.backgroundColor = '#B12425'

            } else {

                adicionarLinha = false

            }
        }

        if (adicionarLinha) {

            tr.append(label_anexos, label_departamentos, label_categorias, label_beneficiario, label_observacao, label_valor, label_data_registro, label_data, label_criado, label_aprovado);

            if ((acesso.usuario == criado || acesso.permissao === 'adm' || acesso.permissao === 'fin') && aprovado == '' || (aprovado != '' && cod_status != 1)) {

                tr.appendChild(label_editar)

            } else {

                tr.appendChild(label_nao_pode_editar)

            }

            if (acesso.permissao === 'adm' || acesso.permissao === 'fin') {

                if (aprovado === '' || cod_status == undefined || cod_status == 0) {

                    tr.appendChild(label_aprov);

                } else if (cod_status == 1) {

                    tr.appendChild(label_ok);

                } else if (cod_status == 3) {

                    tr.appendChild(label_atualizar);

                } else if (cod_status == 4) {

                    tr.appendChild(label_exclusao_falhou);

                }

                tr.append(label_excluir, label_status);

            }

            listagem.appendChild(tr);

        }
    }
}

function abrir_anexos(anexos) {

    document.getElementById('mostrar_anexos').style.display = 'block'
    document.getElementById('local_anexos').innerHTML = ''

    anexos.forEach(function (item) {

        adicionar_anexos_card(item.nome_arquivo, item.link, item.tipo, item.data, item.id, 'local_anexos')

    })

}

function closePopup_anexos() {

    document.getElementById('mostrar_anexos').style.display = 'none'

}


function editarPagamento_sistema(id_pag) {

    abrir_pagamentos()

    let lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos'))
    let dadosPagamento = lista_pagamentos[id_pag].param[0]

    let partes = dadosPagamento.data_vencimento.split('/');
    let dia = partes[0];
    let mes = partes[1];
    let ano = partes[2];
    let dataFormatada = `${ano}-${mes}-${dia}`;

    document.getElementById('data_pagamento').value = dataFormatada

    document.getElementById('valor_pagamento').value = dadosPagamento.valor_documento
    document.getElementById('descricao_pagamento').value = dadosPagamento.observacao
    document.getElementById('cliente_pagamento').value = omie_cliente[dadosPagamento.codigo_cliente_fornecedor]

    let categorias = dadosPagamento.categorias

    categorias.forEach(function (item, indexC) {

        let i = indexC + 1
        add_categoria_departamento('categoria')
        document.getElementById('A' + i).value = omie_categorias[item.codigo_categoria]
        document.getElementById('X' + i).value = item.valor

    })

    let distribuicao = dadosPagamento.distribuicao

    distribuicao.forEach(function (item, indexD) {

        let i = indexD + 1
        add_categoria_departamento('departamento')
        document.getElementById('B' + i).value = omie_departamentos[item.cCodDep]
        document.getElementById('Y' + i).value = item.nValDep

    })

    localStorage.setItem('editar_pagamento', id_pag)

    if (lista_pagamentos[id_pag].anexos) {

        let anexos = lista_pagamentos[id_pag].anexos
        localStorage.setItem('anexos_pagamentos', JSON.stringify(anexos))

        anexos.forEach(function (anexo) {

            adicionar_anexos_card(anexo.nome_arquivo, anexo.link, anexo.tipo, anexo.data, anexo.id, 'container_anexos')

        })

    }

    total_pagamento()

}

function apagarPagamento_sistema(id_pag) {

    openPopup('Deseja realmente apagar este registro?')

    let sim_nao = document.getElementById('sim_nao')

    sim_nao.innerHTML = ''
    sim_nao.style = 'display: flex; justify-content: space-evenly; align-items: center;'

    let botao_sim = document.createElement('button')
    let botao_nao = document.createElement('button')
    botao_sim.textContent = 'Confirmar'
    botao_nao.textContent = 'Cancelar'
    botao_sim.style.backgroundColor = 'green'
    botao_nao.style.backgroundColor = '#B12425'

    botao_sim.addEventListener('click', function () {

        let lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos'))

        if (!lista_pagamentos[id_pag].cod_status || lista_pagamentos[id_pag].cod_status == 4) {

            enviar_lista_pagamentos('excluir2', id_pag)

        } else {

            enviar_lista_pagamentos('excluir', id_pag)

        }

        delete lista_pagamentos[id_pag]

        localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))

        buscar_pagamentos()

        closePopup_financeiro()

    })

    botao_nao.addEventListener('click', function () {

        closePopup_financeiro()

    })

    sim_nao.append(botao_sim, botao_nao)

}

function closePopup_financeiro() {

    document.getElementById('myPopup').style.display = 'none'
    document.getElementById('formulario_pagamento').style.display = 'none'
    document.getElementById('sim_nao').innerHTML = ''
    document.getElementById('valor_pagamento').value = ''
    document.getElementById('descricao_pagamento').value = ''
    document.getElementById('cliente_pagamento').value = ''
    localStorage.removeItem('editar_pagamento')
    localStorage.removeItem('anexos_pagamentos')

}

function add_categoria_departamento(container) {

    let container_div = document.getElementById('container_' + container)

    let div = document.createElement('div')
    let label = document.createElement('label')
    let label_valor = document.createElement('label')
    let input = document.createElement('input')
    let input_valor = document.createElement('input')
    let datalist = document.createElement('datalist')
    let img = document.createElement('img')

    input.addEventListener('change', function () {

        total_pagamento()

    })

    input_valor.addEventListener('change', function () {

        total_pagamento()

    })

    img.src = "/imagens/excluir.png"
    img.classList = 'img_excluir'
    img.addEventListener('click', function () {

        let containerDivs = document.getElementById('container_' + container)
        let divs = containerDivs.querySelectorAll('div')

        if (divs.length == 1) {

            openPopup('É Obrigatório ter pelo menos 1 ' + container)

        } else {

            div.remove()
            total_pagamento(container)

        }

    })

    div.style = 'display: flex; align-items: center'
    label.classList = 'label_form_label'
    input.classList = 'label_form'

    label_valor.classList = 'label_form_label'
    input_valor.classList = 'label_form'
    input_valor.type = 'number'

    label_valor.textContent = 'Valor'

    if (container == 'categoria') {

        let i = maiorId('A')
        input.id = 'A' + i
        label.textContent = i + '.' + maiuscula(container)
        label_valor.id = 'C' + i
        input_valor.id = 'X' + i
        datalist.id = 'W' + i

    } else {

        let i = maiorId('B')
        input.id = 'B' + i
        label.textContent = i + '.' + maiuscula(container)
        label_valor.id = 'T' + i
        input_valor.id = 'Y' + i
        datalist.id = 'V' + i

    }

    input.setAttribute('list', datalist.id)

    div.append(label, input, datalist, label_valor, input_valor, img)

    container_div.appendChild(div)

    buscar_datalists(container + 's', datalist.id)

    total_pagamento()

}

function buscar_datalists(base, id_datalist) {

    let itens = JSON.parse(localStorage.getItem('dados_' + base))
    let datalist = document.getElementById(id_datalist);
    datalist.innerHTML = ''

    for (let item in itens) {

        let option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);

    }

}

function maiuscula(string) {

    return string.charAt(0).toUpperCase() + string.slice(1);

}


let elementos = ['valor_pagamento']

elementos.forEach(function (elemento) {

    let elem = document.getElementById(elemento)
    elem.addEventListener('change', function () {

        total_pagamento()

    })

})

function total_pagamento(container) {

    let valor_pagamento = Number(document.getElementById('valor_pagamento').value)

    let liberar = true

    let tamanhoA = maiorId('A')
    let total_categorias = 0
    let qtdA = 0

    for (let i = 1; i < tamanhoA; i++) {

        if (document.getElementById('X' + i)) {

            qtdA++;

            let valor_cat = Number(document.getElementById('X' + i).value)
            total_categorias += valor_cat

            if (document.getElementById('A' + i).value == '') {

                document.getElementById('A' + i).style.backgroundColor = '#B12425'
                liberar = false

            } else {

                document.getElementById('A' + i).style.backgroundColor = ''

            }
        }
    }

    if (qtdA === 1) {

        for (let i = 1; i < tamanhoA; i++) {

            if (document.getElementById('X' + i)) {

                document.getElementById('X' + i).style.display = 'none';
                document.getElementById('C' + i).style.display = 'none';
                document.getElementById('X' + i).value = valor_pagamento;

            }

        }

    } else {

        for (let i = 1; i < tamanhoA; i++) {

            if (document.getElementById('X' + i)) {

                if (container == 'categoria') {

                    let div_cat = valor_pagamento / qtdA
                    document.getElementById('X' + i).value = div_cat

                }

                document.getElementById('X' + i).style.display = 'block';
                document.getElementById('C' + i).style.display = 'block';

            }

        }

    }

    if (container == 'categoria') {

        total_categorias = valor_pagamento

    }

    if (total_categorias != valor_pagamento) {

        for (let i = 1; i < tamanhoA; i++) {

            let inputElement = document.getElementById('X' + i);

            if (inputElement) {

                inputElement.style.backgroundColor = '#B12425';
                liberar = false

            }

        }

    } else {

        for (let i = 1; i < tamanhoA; i++) {

            let inputElement = document.getElementById('X' + i);

            if (inputElement) {

                inputElement.style.backgroundColor = '';

            }

        }

    }

    let tamanhoB = maiorId('B')
    let total_departamentos = 0
    let qtdB = 0

    for (let i = 1; i < tamanhoB; i++) {

        if (document.getElementById('Y' + i)) {

            qtdB++;

            let valor_dep = Number(document.getElementById('Y' + i).value)
            total_departamentos += valor_dep

            if (document.getElementById('B' + i).value == '') {

                document.getElementById('B' + i).style.backgroundColor = '#B12425'
                liberar = false

            } else {

                document.getElementById('B' + i).style.backgroundColor = ''

            }

        }

    }

    if (qtdB === 1) {

        for (let i = 1; i < tamanhoB; i++) {

            if (document.getElementById('Y' + i)) {

                document.getElementById('Y' + i).style.display = 'none';
                document.getElementById('T' + i).style.display = 'none';
                document.getElementById('Y' + i).value = valor_pagamento;

            }

        }

    } else {

        for (let i = 1; i < tamanhoB; i++) {

            if (document.getElementById('Y' + i)) {

                if (container == 'departamento') {

                    let div_dep = valor_pagamento / (tamanhoB - 1)
                    document.getElementById('Y' + i).value = div_dep

                }

                document.getElementById('Y' + i).style.display = 'block';
                document.getElementById('T' + i).style.display = 'block';

            }

        }
        
    }

    if (container == 'departamento') {

        total_departamentos = valor_pagamento

    }

    if (total_departamentos != valor_pagamento) {

        for (let i = 1; i < tamanhoB; i++) {

            let inputElement = document.getElementById('Y' + i);

            if (inputElement) {

                inputElement.style.backgroundColor = '#B12425';
                liberar = false

            }

        }

    } else {

        for (let i = 1; i < tamanhoB; i++) {

            let inputElement = document.getElementById('Y' + i);

            if (inputElement) {

                inputElement.style.backgroundColor = '';

            }

        }

    }

    return liberar
}

function criar_pagamento_v2() {


    function continuar() {

        let editarPagamento = localStorage.getItem('editar_pagamento')

        if (editarPagamento) {

            let id_pagamento = editarPagamento
            localStorage.removeItem('editar_pagamento')

        } else {

            let id_pagamento = unicoID()

        }

        let tamanho = maiorId('B')

        for (let i = 1; i < tamanho; i++) {

            if (document.getElementById('B' + i)) {

                let valor_dep = Number(document.getElementById('Y' + i).value)
                let nome_departamento = document.getElementById('B' + i).value

                let linha = {

                    'cCodDep': dados_departamentos[nome_departamento],
                    'nValDep': valor_dep

                }

                rateio_departamentos.push(linha)

            }

        }

        tamanho = maiorId('A')

        for (let i = 1; i < tamanho; i++) {

            if (document.getElementById('A' + i)) {

                let valor_cat = Number(document.getElementById('X' + i).value)
                let cod_categoria = document.getElementById('A' + i).value

                let linha = {

                    'codigo_categoria': dados_categorias[cod_categoria],
                    'valor': valor_cat

                }

                rateio_categorias.push(linha)

            }

        }

        let param = [

            {

                "codigo_cliente_fornecedor": dados_clientes[cliente_pagamento].omie,
                "valor_documento": valor_pagamento,
                "observacao": descricao_pagamento,
                "codigo_lancamento_integracao": id_pagamento,
                "data_vencimento": data_pagamento,
                "categorias": rateio_categorias,
                "data_previsao": data_pagamento,
                "id_conta_corrente": '6054234828',
                "distribuicao": rateio_departamentos

            }

        ]

        let anexos = JSON.parse(localStorage.getItem('anexos_pagamentos')) || []

        let dataAtual = new Date();

        let dataFormatada = dataAtual.toLocaleString('pt-BR', {

            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'

        });

        let pagamento = {

            'data_registro': dataFormatada,
            'anexos': anexos,
            'criado': acesso.usuario,
            'aprovado': '',
            param

        }

        localStorage.removeItem('anexos_pagamentos')

        lista_pagamentos[id_pagamento] = pagamento
        localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))

        enviar_lista_pagamentos()

        buscar_pagamentos();

    }

}


function cadastrarCliente(nome, cnpj_cpf) {

    return new Promise((resolve, reject) => {

        let bloco = `cdc29_${nome}_${cnpj_cpf}`

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=' + bloco

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');
                    
                }

                return response.json();

            })

            .then(data => {

                localStorage.setItem('resposta_cliente_cadastrado', JSON.stringify(data))
                resolve();

            })
            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}


function aprovarPagamento(param) {

    let requisicao = {

        'tabela': 'aprovarPagamento',
        'param': param

    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requisicao)
        
    })

}

document.getElementById('adicionar_anexo').addEventListener('change', function () {

    let file = this.files[0];

    if (file) {

        let fileInput = document.getElementById('adicionar_anexo');
        let file = fileInput.files[0];
        let fileName = file.name

        if (!file) {

            alert('Please select a file.');
            return;

        }

        let reader = new FileReader();

        reader.onload = async (e) => {

            let base64 = e.target.result.split(',')[1];
            let mimeType = file.type;

            let response = await fetch('http://localhost:3000/upload', {

                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: fileName,
                    mimeType: mimeType,
                    base64: base64
                })

            });

            let result = await response.json();

            if (response.ok) {

                let data = new Date().toLocaleDateString('pt-BR')
                let id = unicoID()

                let anexo = {

                    'id': id,
                    'nome_arquivo': fileName,
                    'tipo': mimeType,
                    'data': data,
                    'link': result.fileId

                }

                let anexos = JSON.parse(localStorage.getItem('anexos_pagamentos'))

                if (!anexos) {

                    anexos = [];

                }

                anexos.push(anexo);

                localStorage.setItem('anexos_pagamentos', JSON.stringify(anexos))

                adicionar_anexos_card(fileName, result.fileId, mimeType, data, id, 'container_anexos')

            } else {

                openPopup(result.message)

            }
        };

        reader.readAsDataURL(file);

    }

});


function adicionar_anexos_card(nome_arquivo, link, tipo, data, id, div) {

    let anexos = document.getElementById(div)
    let div_caixa = document.createElement('div')
    let div_anexo = document.createElement('div')
    let div_tipo = document.createElement('div')
    let a = document.createElement('a')
    let p = document.createElement('p')
    let div_data_excluir = document.createElement('div')
    div_data_excluir.style = 'display: flex; align-items: center;'

    p.style.marginLeft = '10px'
    a.style.marginLeft = '10px'
    div_caixa.classList = 'caixa_anexo'
    div_anexo.classList = 'anexo'
    div_tipo.classList = 'tipo'
    let tipo_ = formato(tipo)
    div_tipo.textContent = tipo_
    a.href = 'https://drive.google.com/uc?id=' + link
    a.textContent = nome_arquivo

    p.textContent = 'Adicionado: ' + data

    let a2 = document.createElement('a')

    a2.classList = 'desvincular'

    a2.addEventListener('click', function () {

        openPopup('Deseja realmente excluir o anexo?')
        document.getElementById('sim_nao_anexo').style = 'display: flex; align-items: center; justify-content: space-evenly;'
        document.getElementById('confirmar_exclusao_anexo').addEventListener('click', function () {

            // excluir_anexo_pagamento(id)

        })

    })

    a2.textContent = 'Excluir'

    div_data_excluir.append(p, a2)
    div_anexo.append(a, p)
    div_caixa.append(div_tipo, div_anexo)
    anexos.appendChild(div_caixa)
    
}
