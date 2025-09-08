
var autorizacao = '';
var lojas = {};
var ocorrencias = {};
var carregamento;
var progresso = 0
var maximo;
var contagem = 0
var inputs = ['pesquisar', 'inicio', 'fim', 'inativo']

inputs.forEach(inp => {
    document.getElementById(inp).addEventListener('input', function () {
        pesquisar()
    })
})

filtros = {
    executor: [],
    solicitante: [],
    tipoCorrecaoNome: [],
    statusTexto: ['Em Aberto', 'Finalizado em Atraso', 'Finalizado no Prazo'],
    regiao: []
};

iniciarIndexedDB()

setTimeout(function () {
    inicializar();
}, 1000)

function ocultar_exibir() {
    var menus_ocultar = ['menu1', 'menu2', 'excel'];
    var isVisible = document.getElementById(menus_ocultar[0]).style.display !== 'none';

    menus_ocultar.forEach((item) => {
        document.getElementById(item).style.display = isVisible ? 'none' : 'flex';
    });

    var imagem = document.getElementById('exibir');
    var currentRotation = imagem.style.transform === 'rotate(180deg)' ? 'rotate(0deg)' : 'rotate(180deg)';
    imagem.style.transform = currentRotation;
}

async function inicializar() {

    var acesso_leankeep = JSON.parse(localStorage.getItem('acesso_leankeep'))

    if (!acesso_leankeep) {
        document.getElementById('overlay').style.display = 'block'
        document.getElementById('acesso').style.display = 'block'

    } else {

        var label_usuario = document.getElementById('mostrar_usuario')
        label_usuario.textContent = acesso_leankeep.usuario + ' • Sair'
        label_usuario.addEventListener('click', function () {
            document.getElementById('overlay').style.display = 'block'
            document.getElementById('deslogar').style.display = 'flex'
        })

        mensagem_carregamento('Buscando dados...')

        var objeto = await recuperarDados()

        if (objeto && objeto.length !== 0) {
            lancar_na_pagina()
            pesquisar()
            var carimbo = localStorage.getItem('carimbo')
            if (carimbo) {
                document.getElementById('carimbo').textContent = `Atualizado em: ${new Date(carimbo).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
            }
        } else {
            atualizar_dados_api()
        }

        pesquisar()

    }
}

function deslogar() {
    localStorage.removeItem('acesso_leankeep')
    fechar_usuario()
    inicializar()
}

async function salvar_acesso() {
    var senha = document.getElementById('senha').value
    var usuario = document.getElementById('usuario').value

    if (senha !== '' && usuario !== '') {
        var acesso_leankeep = {
            usuario: usuario,
            senha: senha
        }
        localStorage.setItem('acesso_leankeep', JSON.stringify(acesso_leankeep))

        await leankeep()

        var acesso_leankeep = JSON.parse(localStorage.getItem('acesso_leankeep'))
        if (acesso_leankeep) {
            inicializar()
        }

    } else {
        document.getElementById('aviso').style.display = 'block'
    }
}

function mensagem_carregamento(mensagem) {
    var ocorrencias = document.getElementById('ocorrencias')
    ocorrencias.innerHTML = ''
    ocorrencias.style.width = '100%'
    var div_aguarde = document.createElement('div')
    div_aguarde.style = 'display: flex; align-items: center; justify-content: center; width: 100%; gap: 5px; color: #ffffff;'
    var img = document.createElement('img')
    img.src = 'https://i.imgur.com/UszJJsg.gif'
    img.style.width = '5vw'

    var label_aguarde = document.createElement('label')
    label_aguarde.style.color = '#ffffff'
    label_aguarde.textContent = mensagem

    div_aguarde.append(img, label_aguarde)
    ocorrencias.appendChild(div_aguarde)
}

async function atualizar_dados_api() {

    mensagem_carregamento('Autenticando o LeanKeep...')
    await leankeep(); // Autorização;

    mensagem_carregamento('Baixando ocorrências...')
    await buscar_ocorrencias();

    lancar_na_pagina()
    pesquisar()

    localStorage.setItem('carimbo', new Date())
    document.getElementById('carimbo').textContent = `Atualizado em: ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

var estados = {
    1: { 'estado': 'Acre', 'sigla': 'AC' },
    2: { 'estado': 'Alagoas', 'sigla': 'AL' },
    3: { 'estado': 'Amapá', 'sigla': 'AP' },
    4: { 'estado': 'Amazonas', 'sigla': 'AM' },
    5: { 'estado': 'Bahia', 'sigla': 'BA' },
    6: { 'estado': 'Ceará', 'sigla': 'CE' },
    7: { 'estado': 'Distrito Federal', 'sigla': 'DF' },
    8: { 'estado': 'Goiás', 'sigla': 'GO' },
    9: { 'estado': 'Espírito Santo', 'sigla': 'ES' },
    10: { 'estado': 'Maranhão', 'sigla': 'MA' },
    11: { 'estado': 'Mato Grosso', 'sigla': 'MT' },
    12: { 'estado': 'Mato Grosso do Sul', 'sigla': 'MS' },
    13: { 'estado': 'Minas Gerais', 'sigla': 'MG' },
    14: { 'estado': 'Pará', 'sigla': 'PA' },
    15: { 'estado': 'Paraíba', 'sigla': 'PB' },
    16: { 'estado': 'Paraná', 'sigla': 'PR' },
    17: { 'estado': 'Pernambuco', 'sigla': 'PE' },
    18: { 'estado': 'Piauí', 'sigla': 'PI' },
    19: { 'estado': 'Rio de Janeiro', 'sigla': 'RJ' },
    20: { 'estado': 'Rio Grande do Norte', 'sigla': 'RN' },
    21: { 'estado': 'Rio Grande do Sul', 'sigla': 'RS' },
    22: { 'estado': 'Rondônia', 'sigla': 'RO' },
    23: { 'estado': 'Roraima', 'sigla': 'RR' },
    24: { 'estado': 'São Paulo', 'sigla': 'SP' },
    25: { 'estado': 'Santa Catarina', 'sigla': 'SC' },
    26: { 'estado': 'Sergipe', 'sigla': 'SE' },
    27: { 'estado': 'Tocantins', 'sigla': 'TO' }
}

async function leankeep() {
    return new Promise((resolve, reject) => {
        var url = 'https://auth.lkp.app.br/v1/auth';

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        var acesso_leankeep = JSON.parse(localStorage.getItem('acesso_leankeep'));

        if (acesso_leankeep) {
            var body = {
                'Login': acesso_leankeep.usuario,
                'Password': acesso_leankeep.senha,
                'Platform': 8,
                'StayConnected': false,
                'ExpireCurrentSession': true
            };

            function encodeFormData(data) {
                var encoded = [];
                for (var key in data) {
                    encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
                }
                return encoded.join('&');
            }

            fetch(url, {
                method: 'POST',
                headers: headers,
                body: encodeFormData(body)
            })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(errData => {
                            localStorage.removeItem('acesso_leankeep');
                            document.getElementById('aviso').style.display = 'block'
                            document.getElementById('aviso').textContent = 'Senha/Usuário inválido(s), tente novamente.'
                            reject('Erro na autenticação: ' + (errData.message || 'Resposta inesperada.'));
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    autorizacao = data.authToken.token;
                    document.getElementById('acesso').style.display = 'none'
                    document.getElementById('overlay').style.display = 'none'
                    resolve(data);
                })
                .catch(error => {
                    localStorage.removeItem('acesso_leankeep');
                    document.getElementById('aviso').style.display = 'block'
                    document.getElementById('aviso').textContent = 'Senha/Usuário inválido(s), tente novamente.'
                    reject(false);
                });
        } else {
            localStorage.removeItem('acesso_leankeep');
            document.getElementById('aviso').style.display = 'block'
            document.getElementById('aviso').textContent = 'Senha/Usuário inválido(s), tente novamente.'
            reject(false);
        }
    });
}

async function buscarCorrecao_v2(anomaliaID) {
    return new Promise((resolve, reject) => {
        fetch(`https://lighthousev2.lkp.app.br/v1/correcoes?ocorrenciaId=${anomaliaID}`, {
            method: 'GET',
            headers: {
                'accept': 'text/plain',
                'EmpresaId': '5795',
                'Authorization': `Bearer ${autorizacao}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro na requisição: ' + response.statusText);
                }
                return response.text();
            })
            .then(data => {

                contagem += 1
                progresso = (contagem / maximo) * 100
                var carregamento = document.getElementById("carregamento")
                carregamento.textContent = progresso.toFixed(0) + '%'

                resolve(data);
            })
            .catch(error => {
                console.error('Erro ao buscar dados:', error);
                reject()
            });

    })
}

function calcularDiferencaEmDias(data1, data2) {
    if (data1 == '') {
        return 0
    } else {
        const umDiaEmMilissegundos = 1000 * 60 * 60 * 24;
        return Math.floor((data1 - data2) / umDiaEmMilissegundos);
    }
}

async function tipoCorrecoes() {
    return new Promise((resolve, reject) => {
        fetch('https://lighthousev2.lkp.app.br/v1/correcoes/tipos', {
            method: 'GET',
            headers: {
                'accept': 'text/plain',
                'EmpresaId': '5795',
                'Authorization': 'Bearer ' + autorizacao
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro na requisição: ' + response.statusText);
                }
                return response.text();  // Como o tipo de resposta esperado é 'text/plain'
            })
            .then(data => {
                data = JSON.parse(data)
                var tipo_ocorrencias = {}

                Object.keys(data).forEach(function (item) {
                    tipo_ocorrencias[data[item].codigo] = data[item].nome
                })
                localStorage.setItem('tipo_ocorrencias', JSON.stringify(tipo_ocorrencias))
                resolve();
            })
            .catch(error => {
                console.error('Erro ao buscar dados:', error);
                reject()
            });
    })

}

function obterValoresSelecionados(selectElement) {
    const selectedValues = [];
    for (let option of selectElement.options) {
        if (option.selected) {
            selectedValues.push(option.value.toLowerCase());
        }
    }
    return selectedValues;
}

async function pesquisar() {
    var listagens = {
        executor: [],
        solicitante: [],
        tipoCorrecaoNome: [],
        statusTexto: []
    };

    // Pega as marcações feitas em cada filtro
    Object.keys(listagens).forEach(item => {
        var select_da_marcacao = document.getElementById(item);
        var checkboxes = select_da_marcacao.querySelectorAll('input');
        var labels_nomes = select_da_marcacao.querySelectorAll('label');

        // Adiciona as marcações para o filtro
        checkboxes.forEach(function (check, i) {
            if (check.checked == true) {
                listagens[item].push(String(labels_nomes[i].textContent).trim());
            }
        });
    });

    var dados_ocorrencias = {}
    var objeto = await recuperarDados() || []

    objeto.forEach(linha => {
        dados_ocorrencias[linha.chamado] = linha
    })

    var inicio = document.getElementById('inicio').value ? new Date(document.getElementById('inicio').value) : null;
    var fim = document.getElementById('fim').value ? new Date(document.getElementById('fim').value) : null;
    var pesquisar = String(document.getElementById('pesquisar').value).toLowerCase();
    var inativo = document.getElementById('inativo').checked; // Se true, então ignorar inativos;

    if (inicio) inicio.setUTCHours(0, 0, 0, 0);
    if (fim) fim.setUTCHours(23, 59, 59, 999);

    var ocorrencias = document.getElementById('ocorrencias');
    var trs = ocorrencias.querySelectorAll('tr');
    var contagem = {
        emAberto: 0,
        atrasado: 0,
        noPrazo: 0
    };

    var total_chamados = 0;

    trs.forEach((tr) => {
        var tds = tr.querySelectorAll('td');
        var ocultar = true;

        var chamado = dados_ocorrencias[tds[0].textContent];

        // Verificações dos filtros
        var mesmo_statusTexto = listagens.statusTexto.length === 0 || listagens.statusTexto.includes(String(chamado.statusTexto || '').trim());
        var mesmo_solicitante = listagens.solicitante.length === 0 || listagens.solicitante.includes(String(chamado.solicitante || '').trim());
        var mesmo_executor = listagens.executor.length === 0 || listagens.executor.includes(String(chamado.executor || '').trim());
        var mesmo_tipoCorrecaoNome = listagens.tipoCorrecaoNome.length === 0 || listagens.tipoCorrecaoNome.includes(String(chamado.tipoCorrecaoNome || '').trim());

        // Se algum filtro não for atendido, mantém oculto
        if (mesmo_statusTexto && mesmo_executor && mesmo_solicitante && mesmo_tipoCorrecaoNome) {
            ocultar = false; // Caso todos os filtros sejam atendidos, exibe
        }

        // Verifica se os inativos vão se ocultar
        inativo && chamado.statuscorrecao == 'Inativo' ? ocultar = true : false;

        // Verifica intervalo de datas
        var dataCadastro = new Date(chamado?.datasolicitacao);

        if (inicio && fim && !(inicio <= dataCadastro && fim >= dataCadastro)) {
            ocultar = true;
        }

        tr.style.display = ocultar ? 'none' : 'table-row';

        // Pesquisa só nas linhas visíveis
        if (!ocultar && pesquisar) {
            var correspondePesquisa = !Array.from(tds).some((td) => td.textContent.toLowerCase().includes(pesquisar));
            if (correspondePesquisa) {
                tr.style.display = 'none';
            }
        }

        if (!ocultar && tr.style.display !== 'none') {
            total_chamados += 1;
            var statusTexto = chamado?.statusTexto;

            if (statusTexto === 'Em Aberto') {
                contagem.emAberto += 1;
            } else if (statusTexto === 'Finalizado em Atraso') {
                contagem.atrasado += 1;
            } else if (statusTexto === 'Finalizado no Prazo') {
                contagem.noPrazo += 1;
            }
        }
    });

    // Atualiza contadores de chamados
    document.getElementById('tchamados').textContent = total_chamados;

    Object.keys(contagem).forEach((item) => {
        document.getElementById('porc_' + item).textContent = (total_chamados > 0 ? (Number(contagem[item]) / total_chamados * 100).toFixed(0) + '%' : '0%');
        document.getElementById('qtde_' + item).textContent = contagem[item];
    });
}

function api_ocorrencias(pagina) {
    return new Promise((resolve, reject) => {

        const url = `https://lighthousev2.lkp.app.br/v1/ocorrencias?PageIndex=${pagina}&PageSize=50`;
        const headers = {
            'accept': 'text/plain',
            'EmpresaId': '5795',
            'Authorization': 'Bearer ' + autorizacao
        };

        fetch(url, {
            method: 'GET',
            headers: headers
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => {
                        console.error('Erro:', errData);
                        reject(new Error('Erro na requisição: ' + response.status));
                    });
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                console.error('Erro:', error);
                reject(error);
            });
    });
}

async function buscar_ocorrencias() {

    var request = indexedDB.open("LeanKeep", 1);
    request.onsuccess = function (event) {
        var db = event.target.result;
        var transaction = db.transaction(["ocorrenciasDB"], "readwrite");
        var store = transaction.objectStore("ocorrenciasDB");
        store.clear();
    }

    await tipoCorrecoes();

    const paginas = 20
    progresso = 0
    contagem = 0

    var ocorrencias = {};
    for (var i = 1; i <= paginas; i++) {

        mensagem_carregamento(`Carregando página ${i} de ${paginas}...`)

        var data = await api_ocorrencias(i);
        if (data) {

            const promises = data.map(async (item) => {
                try {
                    var info_correcoes = await buscarCorrecao_v2(item.anomaliaGid);

                    var parsedData = JSON.parse(info_correcoes);

                    var dias = '', dtAtendimento = '', dtLimite = '', ultimaCorrecao = '', tipoCorrecaoNome = '', descricao = '', executor = '', dataatendimento = '', statusTexto = '';

                    if (parsedData && parsedData.length > 0) {
                        ultimaCorrecao = parsedData[parsedData.length - 1];
                        dtAtendimento = ultimaCorrecao.termino ? new Date(ultimaCorrecao.termino) : '';
                        dtLimite = item.dataLimiteExecucao ? new Date(item.dataLimiteExecucao) : '';
                        var hoje = new Date();
                        dias = dtAtendimento instanceof Date && !isNaN(dtAtendimento)
                            ? calcularDiferencaEmDias(dtLimite, dtAtendimento)
                            : calcularDiferencaEmDias(dtLimite, hoje);

                        tipoCorrecaoNome = ultimaCorrecao.tipoCorrecaoNome;
                        descricao = ultimaCorrecao.descricao;
                        executor = ultimaCorrecao.executoresNomes;
                        dataatendimento = dtAtendimento instanceof Date && !isNaN(dtAtendimento) ? dtAtendimento : '';
                    }

                    statusTexto = dtAtendimento === ''
                        ? 'Em Aberto'
                        : dias < 0
                            ? 'Finalizado em Atraso'
                            : 'Finalizado no Prazo';

                    ocorrencias[item.cqa] = {
                        'anomaliaGid': item.anomaliaGid,
                        'id_unidade': item.siteId,
                        'chamado': item.cqa,
                        'unid_manut': item.siteNome,
                        'datasolicitacao': item.dataRegistro,
                        'datalimite': item.dataLimiteExecucao ? item.dataLimiteExecucao : '',
                        'dataatendimento': dataatendimento,
                        'dias': dias,
                        'statuscorrecao': item.statusNome,
                        'statusTexto': statusTexto,
                        'sistema': item.sistemaEmpresaNome,
                        'descricao': descricao,
                        'tipoCorrecaoNome': tipoCorrecaoNome,
                        'executor': String(executor).replace(/\s+/g, ' ').trim(),
                        'solicitante': (item.emitentes[0].usuarioNome).replace(/\s+/g, ' ').trim(),
                        'correcoes': parsedData
                    };


                } catch (error) {
                    console.error(`Erro ao buscar correção para anomalia ${item.anomaliaGid}:`, error);
                }
            });

            await Promise.all(promises);
        }
    }

    Object.keys(ocorrencias).forEach(chamado => {
        inserirDados(ocorrencias[chamado])
    })

}

function fechar() {
    document.getElementById('detalhes').style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

function fechar_usuario() {
    document.getElementById('deslogar').style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

function selecionarTodos(select_atual) {
    var select = document.getElementById(select_atual + '_input')
    select.innerHTML = ''
    filtros[select_atual].forEach((item) => {
        var option = document.createElement('option')
        option.textContent = item
        select.appendChild(option)
    })

    Array.from(select.options).forEach(option => {
        option.selected = true;
    });

    pesquisar()
}

var filtro_master = {
    executor: false,
    solicitante: false,
    tipoCorrecaoNome: false,
    statusTexto: false,
    regiao: false
}

async function filtrar_outros_selects(nome_da_div_select) {

    var objeto = {}

    var dados_objeto = await recuperarDados()

    dados_objeto.forEach(linha => {
        objeto[linha.chamado] = linha
    })

    var selects = ['executor', 'solicitante', 'tipoCorrecaoNome', 'statusTexto', 'regiao']; // Divs Existentes

    // Atualiza o filtro master
    filtro_master[nome_da_div_select] = true;

    var marcacoes = { // Acumula os itens marcados
        executor: [],
        solicitante: [],
        tipoCorrecaoNome: [],
        statusTexto: [],
        regiao: []
    };

    // Percorre as marcações e armazena os itens selecionados
    Object.keys(marcacoes).forEach(item_marcacao => {
        if (filtro_master[item_marcacao]) {
            var select_da_marcacao = document.getElementById(item_marcacao); // Alterado para usar item_marcacao
            var checkboxes = select_da_marcacao.querySelectorAll('input');
            var labels_nomes = select_da_marcacao.querySelectorAll('label');

            checkboxes.forEach(function (check, i) {
                if (check.checked) {
                    marcacoes[item_marcacao].push(String(labels_nomes[i].textContent).trim());
                }
            });
        }
    });

    // Desativa o filtro se não houver marcações
    if (marcacoes[nome_da_div_select].length === 0) {
        filtro_master[nome_da_div_select] = false;
    }

    selects.forEach(div_select => {
        if (div_select !== nome_da_div_select && !filtro_master[div_select]) {
            var div_pai = document.getElementById(div_select);
            div_pai.innerHTML = ''; // Limpa o conteúdo anterior

            // Cria o botão do dropdown
            var button = document.createElement('button');
            button.textContent = 'Selecione um item';
            button.classList = 'dropdown-toggle';

            button.addEventListener('click', function () {
                this.parentElement.classList.toggle('show');
            });

            var div_drop_down = document.createElement('div');
            div_drop_down.classList = 'dropdown-menu';

            // Botões "Selecionar todos" e "Desmarcar todos"
            var btn_select_all = document.createElement('button');
            btn_select_all.textContent = 'Selecionar todos';
            btn_select_all.classList = 'select-all-btn';
            btn_select_all.style.display = 'block';
            btn_select_all.addEventListener('click', function () {
                var checkboxes_in_dropdown = div_drop_down.querySelectorAll('input');
                checkboxes_in_dropdown.forEach(function (checkbox) {
                    checkbox.checked = true;
                });
                filtrar_outros_selects(div_select);
            });

            var btn_deselect_all = document.createElement('button');
            btn_deselect_all.textContent = 'Desmarcar todos';
            btn_deselect_all.classList = 'deselect-all-btn';
            btn_deselect_all.style.display = 'block';
            btn_deselect_all.addEventListener('click', function () {
                var checkboxes_in_dropdown = div_drop_down.querySelectorAll('input');
                checkboxes_in_dropdown.forEach(function (checkbox) {
                    checkbox.checked = false;
                });
                filtrar_outros_selects(div_select);
            });

            div_drop_down.appendChild(btn_select_all);
            div_drop_down.appendChild(btn_deselect_all);

            var listagem_geral = [];

            // Filtra itens com base nas marcações
            Object.keys(objeto).forEach(chamado => {
                var incluir = true;
                Object.keys(marcacoes).forEach(nome => {
                    // Verifica se algum filtro ativo bate com as ocorrências
                    if (marcacoes[nome].length > 0 && !marcacoes[nome].includes(objeto[chamado][nome])) {
                        incluir = false;
                    }
                });
                if (incluir) {
                    listagem_geral.push(objeto[chamado][div_select]);
                }
            });

            listagem_geral = [...new Set(listagem_geral)].sort();

            // Adiciona as opções no dropdown
            listagem_geral.forEach(item => {
                var label = document.createElement('label');
                var input = document.createElement('input');
                input.type = 'checkbox';

                input.addEventListener('input', function () {
                    filtrar_outros_selects(div_select);
                });

                label.appendChild(input);
                label.appendChild(document.createTextNode(' ' + item));

                div_drop_down.appendChild(label);
            });

            div_pai.append(button, div_drop_down);
        }
    });

    var tudo_vazio = selects.every(div_select => !filtro_master[div_select]);

    if (tudo_vazio) {
        selects.forEach(div_select => {
            var div_pai = document.getElementById(div_select);
            div_pai.innerHTML = '';

            var button = document.createElement('button');
            button.textContent = 'Selecione um item';
            button.classList = 'dropdown-toggle';

            button.addEventListener('click', function () {
                this.parentElement.classList.toggle('show');
            });

            var div_drop_down = document.createElement('div');
            div_drop_down.classList = 'dropdown-menu';

            // Adiciona botões "Selecionar todos" e "Desmarcar todos" dentro do menu
            var btn_select_all = document.createElement('button');
            btn_select_all.textContent = 'Selecionar todos';
            btn_select_all.classList = 'select-all-btn';
            btn_select_all.style.display = 'block';  // Exibe como botão de bloco
            btn_select_all.addEventListener('click', function () {
                var checkboxes_in_dropdown = div_drop_down.querySelectorAll('input');
                checkboxes_in_dropdown.forEach(function (checkbox) {
                    checkbox.checked = true;
                });
                filtrar_outros_selects(div_select);
            });

            var btn_deselect_all = document.createElement('button');
            btn_deselect_all.textContent = 'Desmarcar todos';
            btn_deselect_all.classList = 'deselect-all-btn';
            btn_deselect_all.style.display = 'block';  // Exibe como botão de bloco
            btn_deselect_all.addEventListener('click', function () {
                var checkboxes_in_dropdown = div_drop_down.querySelectorAll('input');
                checkboxes_in_dropdown.forEach(function (checkbox) {
                    checkbox.checked = false;
                });
                filtrar_outros_selects(div_select);
            });

            div_drop_down.appendChild(btn_select_all);
            div_drop_down.appendChild(btn_deselect_all);

            var listagem_geral = [];

            Object.keys(objeto).forEach((chamado) => {
                listagem_geral.push(objeto[chamado][div_select]);
            });

            listagem_geral = [...new Set(listagem_geral)].sort();

            listagem_geral.forEach(item => {
                var label = document.createElement('label');
                var input = document.createElement('input');
                input.type = 'checkbox';

                input.addEventListener('input', function () {
                    filtrar_outros_selects(div_select);
                });

                label.appendChild(input);
                label.appendChild(document.createTextNode(' ' + item));

                div_drop_down.appendChild(label);
            });

            div_pai.append(button, div_drop_down);
        });
    }

    pesquisar();
}


async function lancar_na_pagina() {

    var objeto = {}

    var dados_objeto = await recuperarDados()

    dados_objeto.forEach(linha => {
        objeto[linha.chamado] = linha
    })

    var ocorrencias = document.getElementById('ocorrencias')
    var table = document.createElement('table')

    ocorrencias.innerHTML = ''

    var colunas = ['Chamado', 'Loja', 'Data Abertura', 'Data Limite', 'Data Execução', 'Dias', 'Status Correção', 'Executor', 'Solicitante', 'Detalhes']

    var thead = document.createElement('thead')

    colunas.forEach(function (item) {
        var th = document.createElement('th')
        th.textContent = item
        thead.appendChild(th)
    })

    table.appendChild(thead)

    var entries = Object.entries(objeto);
    entries.sort((a, b) => {
        var itemA = a[1]['dias']
        var itemB = b[1]['dias']

        return itemA - itemB; // Simplificado
    });

    objeto = Object.fromEntries(entries);

    filtros.executor = []
    filtros.solicitante = []
    filtros.tipoCorrecaoNome = []
    filtros.regiao = []

    function labels(titulo, valor) {
        var divin = document.createElement('div')
        var divin = document.createElement('div')
        var span = document.createElement('span')
        var label = document.createElement('label')
        divin.classList = 'row'
        span.classList = 'title'
        label.classList = 'info'

        span.textContent = titulo
        label.textContent = valor

        divin.append(span, label)

        return divin
    }

    Object.keys(objeto).forEach(function (chamado) {
        var tr = document.createElement('tr')

        Object.keys(objeto[chamado]).forEach(function (item) {
            filtros.executor.push(objeto[chamado].executor);
            filtros.solicitante.push(objeto[chamado].solicitante);
            filtros.tipoCorrecaoNome.push(objeto[chamado].tipoCorrecaoNome);
            filtros.regiao.push(objeto[chamado].regiao);

            var td = document.createElement('td')
            if (
                item == 'chamado' ||
                item == 'unid_manut' ||
                item == 'datasolicitacao' ||
                item == 'datalimite' ||
                item == 'dataatendimento' ||
                item == 'dias' ||
                item == 'tipoCorrecaoNome' ||
                item == 'executor' ||
                item == 'solicitante'
            ) {
                var termo = objeto[chamado][item]

                if (String(item).includes('data')) {
                    termo = new Date(termo).toLocaleDateString('pt-BR')
                    if (termo == 'Invalid Date') {
                        termo = '-'
                    }
                } else if (item == 'dias' && termo < 0) {
                    td.style.backgroundColor = '#B12425'
                    td.style.color = '#ffffff'
                }

                td.textContent = termo
                tr.appendChild(td)
            }
        })

        var td = document.createElement('td')
        var img = document.createElement('img')
        img.src = 'https://i.imgur.com/MN0Uc0z.png'
        img.style.width = '15px'
        img.style.cursor = 'pointer'
        img.addEventListener('click', function () { //29
            var overlay = document.getElementById('overlay')
            var detalhes = document.getElementById('detalhes')
            overlay.style.display = 'block'
            detalhes.style.display = 'flex'
            var tr = this.closest('tr');
            var tds = tr.querySelectorAll('td')
            var ocorrencia = objeto[tds[0].textContent]

            detalhes.innerHTML = ''

            var button = document.createElement('button')
            button.textContent = 'x'
            button.classList = 'close-btn'
            button.addEventListener('click', function () {
                fechar()
            })

            var todos = document.createElement('div')
            todos.classList = 'todos_correcoes'
            ocorrencia.correcoes.forEach(item => {
                var individual = document.createElement('div')
                individual.classList = 'individual'

                var inicio = item.inicio == null ? '' : new Date(item.inicio).toLocaleDateString('pt-BR')
                var fim = item.termino == null ? '' : new Date(item.termino).toLocaleDateString('pt-BR')

                var elemento1 = labels('Data registro', inicio)
                var elemento2 = labels('Data fim', fim)
                var elemento3 = labels('Executor da Correção', item.executoresNomes)
                var elemento4 = labels('Status Correção', item.tipoCorrecaoNome)
                var elemento5 = labels('Descrição', item.descricao)

                individual.append(elemento1, elemento2, elemento3, elemento4, elemento5)
                todos.appendChild(individual)
            })

            var elemento1 = labels('Status Correção', ocorrencia.statuscorrecao)
            var elemento2 = labels('Solicitante', ocorrencia.solicitante)
            var elemento3 = labels('Sistema', ocorrencia.sistema)

            detalhes.append(elemento1, elemento2, elemento3, todos, button)

        })
        td.appendChild(img)
        tr.appendChild(td)

        table.appendChild(tr)
    })

    filtros.executor = [...new Set(filtros.executor)].sort();
    filtros.solicitante = [...new Set(filtros.solicitante)].sort();
    filtros.tipoCorrecaoNome = [...new Set(filtros.tipoCorrecaoNome)].sort();
    filtros.regiao = [...new Set(filtros.regiao)].sort();

    ocorrencias.appendChild(table)

    var divs = ['solicitante', 'executor', 'tipoCorrecaoNome', 'statusTexto']

    divs.forEach((div) => {
        var div_pai = document.getElementById(div)
        div_pai.innerHTML = ''
        div_pai.classList = 'dropdown'

        var button = document.createElement('button')
        button.textContent = 'Selecione um item'
        button.classList = 'dropdown-toggle'

        button.addEventListener('click', function () {
            this.parentElement.classList.toggle('show');
        });

        if (div_pai) {
            var div_drop_down = document.createElement('div')
            div_drop_down.classList = 'dropdown-menu'

            // Adiciona botões "Selecionar todos" e "Desmarcar todos" dentro do menu
            var btn_select_all = document.createElement('button');
            btn_select_all.textContent = 'Selecionar todos';
            btn_select_all.classList = 'select-all-btn';
            btn_select_all.style.display = 'block';  // Exibe como botão de bloco
            btn_select_all.addEventListener('click', function () {
                var checkboxes_in_dropdown = div_drop_down.querySelectorAll('input');
                checkboxes_in_dropdown.forEach(function (checkbox) {
                    checkbox.checked = true;
                });
                filtrar_outros_selects(div);
            });

            var btn_deselect_all = document.createElement('button');
            btn_deselect_all.textContent = 'Desmarcar todos';
            btn_deselect_all.classList = 'deselect-all-btn';
            btn_deselect_all.style.display = 'block';  // Exibe como botão de bloco
            btn_deselect_all.addEventListener('click', function () {
                var checkboxes_in_dropdown = div_drop_down.querySelectorAll('input');
                checkboxes_in_dropdown.forEach(function (checkbox) {
                    checkbox.checked = false;
                });
                filtrar_outros_selects(div);
            });

            div_drop_down.appendChild(btn_select_all);
            div_drop_down.appendChild(btn_deselect_all);

            filtros[div].forEach((item) => {
                var label = document.createElement('label');
                var input = document.createElement('input');
                input.addEventListener('input', function () {
                    filtrar_outros_selects(div)
                })
                input.type = 'checkbox';
                label.appendChild(input);
                label.appendChild(document.createTextNode(' ' + item));

                div_drop_down.appendChild(label);
            })

            div_pai.append(button, div_drop_down)
        }
    })

}

var db;

function iniciarIndexedDB() {
    let request = indexedDB.open('LeanKeep', 1);

    request.onupgradeneeded = function (event) {
        db = event.target.result;

        // Criação de Object Store (equivalente a uma tabela)
        if (!db.objectStoreNames.contains('ocorrenciasDB')) {
            db.createObjectStore('ocorrenciasDB', { keyPath: 'id', autoIncrement: true });
        }
        console.log('Object Store "ocorrenciasDB" criada ou já existente');
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        console.log('Banco de dados aberto com sucesso.');
    };

    request.onerror = function (event) {
        console.log('Erro ao abrir o banco de dados:', event.target.errorCode);
    };
}

function inserirDados(dados) {
    if (!db) {
        console.log('Banco de dados não está disponível. Certifique-se de que o IndexedDB foi aberto corretamente.');
        return;
    }

    let transaction = db.transaction(['ocorrenciasDB'], 'readwrite'); // Use o nome correto
    let store = transaction.objectStore('ocorrenciasDB');

    store.add(dados);

    transaction.onerror = function (event) {
        console.log('Erro durante a transação:', event.target.errorCode);
    };
}

async function recuperarDados() {
    if (db) {
        let transaction = db.transaction(['ocorrenciasDB'], 'readonly');
        let store = transaction.objectStore('ocorrenciasDB');

        return new Promise((resolve, reject) => {
            let request = store.getAll();

            request.onsuccess = function (event) {
                let todosOsItens = event.target.result;
                resolve(todosOsItens);
            };

            request.onerror = function (event) {
                console.log('Erro ao recuperar os itens:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    } else {
        console.log('Banco de dados não está disponível.');
        return [];
    }
}

function salvarEmExcel() {

    var ocorrencias = document.getElementById('ocorrencias')

    var trs = ocorrencias.querySelectorAll('tr')

    var data = []

    trs.forEach(tr => {

        var isVisible = tr.style.display !== 'none';
        if (isVisible) {
            var tds = tr.querySelectorAll('td')
            var linha = {
                'Chamado': tds[0].textContent,
                'Loja': tds[1].textContent,
                'Data de Abertura': tds[2].textContent,
                'Data Limite Execução': tds[3].textContent,
                'Data de Execução': tds[4].textContent,
                'Dias em Atraso': tds[5].textContent,
                'Status Correção': tds[6].textContent,
                'Executor': tds[7].textContent,
                'Solicitante': tds[8].textContent,
            }

            data.push(linha)
        }
    })

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);  // Converte JSON para a planilha

    XLSX.utils.book_append_sheet(wb, ws, "Dados");

    XLSX.writeFile(wb, 'Leankeep Chamados.xlsx');
}