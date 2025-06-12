const dados_veiculos = {
    "veiculos": {
        "mobi": {
            "frotas": {
                "AAA-1111": {
                    "codigo": "123456",
                    "placa": "AAA-1111",
                    "modelo": "Mobi Like",
                    "status": "locado"
                }
            },
            "motoristas": {
                "12345": {
                    "nome": "Jhon Dow",
                    "dados_veiculo": {
                        "placa": "AAA-1111",
                        "modelo": "Mobi Like",
                        "status": "locado"
                    },
                    "custo_mensal_veiculo": 1000,
                    "combustível": {
                        "litros": 100,
                        "custo_litro": 5,
                        "custo_total": 500,
                        "anexos": {
                            "O3V5G": {
                                "formato": "servidor",
                                "nome": "NF2307_NOVOATACADOCARPINATREVO_D13096.pdf",
                                "link": "1749566753790.pdf"
                            },
                        }
                    },
                    "pedagio": {
                        "tag": "Sem parar",
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    },
                    "estacionamento": {
                        "tag": "Sem parar",
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    },
                    "multas": {
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    },
                    "custos_extras": {
                        "valor": 100,
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    }
                }
            }
        },
        "estrada": {
            "frotas": {
                "AAA-2222": {
                    "codigo": "123456",
                    "placa": "AAA-2222",
                    "modelo": "Mobi Like",
                    "status": "devolvido"
                }
            },
            "motoristas": {
                "12345": {
                    "nome": "Jane Doe",
                    "dados_veiculo": {
                        "placa": "AAA-1111",
                        "modelo": "Mobi Like",
                        "status": "devolvido"
                    },
                    "custo_mensal_veiculo": 5000,
                    "combustível": {
                        "litros": 100,
                        "custo_litro": 5,
                        "custo_total": 500,
                        "anexos": {
                            "O3V5G": {
                                "formato": "servidor",
                                "nome": "NF2307_NOVOATACADOCARPINATREVO_D13096.pdf",
                                "link": "1749566753790.pdf"
                            },
                        }
                    },
                    "pedagio": {
                        "tag": "Sem parar",
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    },
                    "estacionamento": {
                        "tag": "Sem parar",
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    },
                    "multas": {
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    },
                    "custos_extras": {
                        "valor": 100,
                        "anexos": {
                            "87134": {
                                "formato": "servidor",
                                "nome": "NF42352454525345.pdf",
                                "link": "4545235234534525.pdf"
                            },
                        }
                    }
                }
            }
        }
    },
}

document.addEventListener('DOMContentLoaded', () => {
    montarPainelVeiculos();
});

function montarPainelVeiculos() {
    const container = document.getElementById('tabelaRegistro');
    if (!container) return;

    container.innerHTML = criarLayoutPrincipal();

    const btnCadastrarVeiculo = container.querySelector('#btnCadastrarVeiculo');
    if (btnCadastrarVeiculo) {
        btnCadastrarVeiculo.addEventListener('click', cadastrarVeiculo);
    }

    const filtro = container.querySelector('.veiculos-toolbar-filtro');
    const tbody = container.querySelector('#tabelaMotoristas');

    botoesVeiculos(filtro, tbody);
}

function criarLayoutPrincipal() {
    return `
        <div class="veiculos-toolbar-container">
            <div class="veiculos-toolbar-filtro">
                <button class="botao-cadastro-veiculo" id="btnCadastrarVeiculo">
                    Cadastrar Veículo
                </button>
                <label>Veículos</label>
            </div>
            
            <div class="veiculos-area-tabela">
                <div id="campoTotalMensal" class="total_geral">
                    Total mensal: R$ 0,00
                </div>
                
                <button class="botao-cadastro-motorista" onclick="abrirFormularioCadastro()">
                    Cadastrar Novo Motorista
                </button>
                
                <table class="tabela">
                    <thead class="ths">
                        <tr>
                            <th>Motoristas</th>
                            <th>Dados Veículo</th>
                            <th>Custo Mensal Veículo</th>
                            <th>Combustível</th>
                            <th>Pedágio</th>
                            <th>Estacionamento</th>
                            <th>Multas</th>
                            <th>Custos Extras</th>
                        </tr>
                    </thead>
                    <tbody id="tabelaMotoristas"></tbody>
                </table>
            </div>
        </div>
    `;
}

function cadastrarVeiculo() {
    const form = `
        <div class="form-cadastro-veiculo">
            <div class="form-grupo">
                <label>Nome do Veículo</label>
                <input type="text" id="nome_veiculo" placeholder="Ex: Mobi">
            </div>

            <div class="form-grupo">
                <label>Frota</label>
                <input type="text" id="placa_frota" placeholder="Placa">
                <input type="text" id="modelo_frota" placeholder="Modelo">
                <select id="status_frota">
                    <option value="">Selecione o status</option>
                    <option value="locado">Locado</option>
                    <option value="devolvido">Devolvido</option>
                </select>
            </div>

            <div class="botoes-form">
                <button class="botao-form primario" onclick="salvarVeiculo()">
                    Cadastrar Veículo
                </button>
            </div>
        </div>
    `;

    openPopup_v2(form, 'Cadastro de Veículo');
}

function salvarVeiculo() {
    const nomeVeiculo = document.getElementById('nome_veiculo').value.toLowerCase();
    const placa = document.getElementById('placa_frota').value;
    const modelo = document.getElementById('modelo_frota').value;
    const status = document.getElementById('status_frota').value;

    const camposObrigatorios = [nomeVeiculo, placa, modelo];
    if (camposObrigatorios.some(campo => campo === '')) {
        openPopup_v2('Por favor, preencha os campos obrigatórios', 'Campo obrigatório', true);
        return;
    }

    dados_veiculos.veiculos[nomeVeiculo] = {
        frotas: {
            [placa]: {
                placa: placa,
                modelo: modelo,
                status: status
            }
        },
        motoristas: {}
    };

    const container = document.getElementById('tabelaRegistro');
    if (container) {
        container.innerHTML = criarLayoutPrincipal();
        const filtro = container.querySelector('.veiculos-toolbar-filtro');
        const tbody = container.querySelector('#tabelaMotoristas');
        botoesVeiculos(filtro, tbody);
    }

    removerOverlay();
}

function botoesVeiculos(filtro) {
    Object.keys(dados_veiculos.veiculos).forEach(nomeVeiculo => {
        const btnHtml = `
            <button type="button" class="filtro-veiculo" onclick="selecionarVeiculo(this, '${nomeVeiculo}')">
                ${nomeVeiculo.toUpperCase()}
            </button>
        `;
        filtro.insertAdjacentHTML('beforeend', btnHtml);
    });
}

function selecionarVeiculo(button, nomeVeiculo) {
    const filtro = button.closest('.veiculos-toolbar-filtro');
    filtro.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
    preencherTabelaMotoristas(nomeVeiculo);
}

function criarLinhaMotorista(motorista) {
    const custoMensal = motorista.custo_mensal_veiculo || 'R$ 0,00';
    const combustivel = motorista.combustível || {};
    const pedagio = motorista.pedagio || {};
    const estacionamento = motorista.estacionamento || {};
    const multas = motorista.multas || {};
    const extras = motorista.custos_extras || {};

    // Codificar os dados do veículo para passar como parâmetro
    const dadosVeiculo = encodeURIComponent(JSON.stringify(motorista.dados_veiculo));

    return `
        <tr>
            <td>${motorista.nome || ''}</td>
            <td>
                <button 
                    class="botao-dados-veiculo" 
                    onclick="mostrarDadosVeiculo('${dadosVeiculo}')"
                    style="
                        background-color: #24729d;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                    "
                >
                    Ver Dados do Veículo
                </button>
            </td>
            <td>${custoMensal}</td>
            <td>${combustivel.litros ? `${combustivel.litros}L x ${combustivel.custo_litro} = ${combustivel.custo_total}` : ''}</td>
            <td>${pedagio.tag || ''}</td>
            <td>${estacionamento.tag || ''}</td>
            <td>${Object.keys(multas.anexos || {}).length ? 'Sim' : 'Não'}</td>
            <td>${extras.valor || ''}</td>
        </tr>
    `;
}

function mostrarDadosVeiculo(dadosVeiculoEncoded) {
    const dadosVeiculo = JSON.parse(decodeURIComponent(dadosVeiculoEncoded));

    const conteudo = `
        <div class="info">
            <div class="info-title">
                <img src="imagens/veiculo.png">
                <h3>Dados do Veículo</h3>
            </div>
            
            <div class="info-grupos">
                <div class="info-grupo">
                    <label>Placa:</label>
                    <span>${dadosVeiculo.placa || 'Não informado'}</span>
                </div>
                
                <div class="info-grupo">
                    <label>Modelo:</label>
                    <span>${dadosVeiculo.modelo || 'Não informado'}</span>
                </div>
                
                <div class="info-grupo">
                    <label>Status:</label>
                    <span style="color: ${dadosVeiculo.status === 'locado' ? 'green' : 'red'};">
                        ${dadosVeiculo.status || 'Não informado'}
                    </span>
                </div>
            </div>
        </div>
    `;

    openPopup_v2(conteudo, 'Informações do Veículo');
}

function preencherTabelaMotoristas(nomeVeiculo) {
    const tbody = document.getElementById('tabelaMotoristas');
    const campoTotal = document.getElementById('campoTotalMensal');
    const veiculo = dados_veiculos.veiculos[nomeVeiculo];

    if (!tbody || !veiculo || !veiculo.motoristas) return;

    let total = 0;
    let linhasHtml = '';

    Object.values(veiculo.motoristas).forEach(motorista => {
        const custoMensal = motorista.custo_mensal_veiculo || 'R$ 0,00';
        const valor = Number(custoMensal.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        total += valor;

        linhasHtml += criarLinhaMotorista(motorista);
    });

    tbody.innerHTML = linhasHtml;

    if (campoTotal) {

        function selecionarMotorista(id, nome, veiculo, divOpcao) {
            let div = divOpcao.parentElement;
            let textarea = div.previousElementSibling;

            textarea.value = nome;
            div.innerHTML = '';

            // lógica adicional para preencher outros campos
        }
        campoTotal.textContent = `Total mensal: R$ ${total.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
}

function abrirFormularioCadastro() {
    const form = `
        <div class="form-cadastro-motorista">
            <button class="botao-form secundario" onclick="atualizarListaMotoristas()">
                Atualizar Lista de Motoristas
            </button>
        
            <div class="form-grupo">
                <label>Nome do Motorista</label>
                <div class="autocomplete-container">
                    <input 
                        class="autocomplete-input"
                        id="nome_motorista"
                        type="text"
                        placeholder="Digite o nome do motorista..."
                        oninput="carregarMotoristas(this)"
                    >
                    <div class="autocomplete-list"></div>
                </div>
            </div>
            
            <div class="form-grupo">
                <label>Dados do Veículo</label>
                <input type="text" id="placa" placeholder="Placa">
                <input type="text" id="modelo" placeholder="Modelo">
                <select id="status">
                    <option value="">Selecione o status</option>
                    <option value="locado">Locado</option>
                    <option value="devolvido">Devolvido</option>
                </select>
            </div>

            <div class="form-grupo">
                <label>Custo Mensal</label>
                <input type="number" id="custo_mensal" placeholder="R$ 0,00">
            </div>

            <div class="form-grupo">
                <label>Combustível</label>
                <input type="number" id="litros" placeholder="Litros">
                <input type="number" id="custo_litro" placeholder="Custo por litro">
                <input type="file" id="combustivel_anexo">
            </div>

            <div class="form-grupo">
                <label>Pedágio</label>
                <input type="text" id="tag_pedagio" placeholder="Tag do pedágio">
                <input type="file" id="pedagio_anexo">
            </div>

            <div class="form-grupo">
                <label>Estacionamento</label>
                <input type="text" id="tag_estacionamento" placeholder="Tag do estacionamento">
                <input type="file" id="estacionamento_anexo">
            </div>

            <div class="form-grupo">
                <label>Custos Extras</label>
                <input type="number" id="custos_extras" placeholder="R$ 0,00">
            </div>

            <div class="botoes-form">
                <button class="botao-form primario" onclick="cadastrarMotorista()">
                    Cadastrar Motorista
                </button>
            </div>
        </div>
    `;

    openPopup_v2(form, 'Cadastro de Motorista');
}

async function carregarMotoristas(textarea) {
    let div = textarea.nextElementSibling;
    let dados_veiculos = await recuperarDados('dados_veiculos') || {};
    let pesquisa = String(textarea.value).toLowerCase();
    let opcoes = '';
    div.innerHTML = '';

    let motoristas = new Set();

    for (let tipoVeiculo in dados_veiculos.veiculos) {
        let motoristasVeiculo = dados_veiculos.veiculos[tipoVeiculo].motoristas || {};
        for (let id in motoristasVeiculo) {
            let motorista = motoristasVeiculo[id];
            if (motorista.nome.toLowerCase().includes(pesquisa)) {
                motoristas.add(JSON.stringify({
                    id: id,
                    nome: motorista.nome,
                    veiculo: tipoVeiculo
                }));
            }
        }
    }

    let motoristasArray = Array.from(motoristas)
        .map(m => JSON.parse(m))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    motoristasArray.forEach(motorista => {
        opcoes += `
            <div onclick="selecionarMotorista('${motorista.id}', '${motorista.nome}', '${motorista.veiculo}', this)" 
                 class="autocomplete-item" 
                 style="text-align: left; padding: 5px; gap: 5px; display: flex; flex-direction: column; align-items: start; justify-content: start; border-bottom: solid 1px #d2d2d2;">
                <label style="font-size: 0.8vw;">${motorista.nome}</label>
                <label style="font-size: 0.7vw;"><strong>Veículo: ${motorista.veiculo}</strong></label>
            </div>
        `;
    });

    if (pesquisa === '') return;

    div.innerHTML = opcoes;
}

function selecionarMotorista(id, nome, veiculo, divOpcao) {
    let div = divOpcao.parentElement;
    let textarea = div.previousElementSibling;

    textarea.value = nome;
    div.innerHTML = '';
}

function cadastrarMotorista() {
    const nome = document.getElementById('nome_motorista').value;
    const placa = document.getElementById('placa').value;
    const modelo = document.getElementById('modelo').value;
    const status = document.getElementById('status').value;
    const custoMensal = document.getElementById('custo_mensal').value;
    const litros = document.getElementById('litros').value;
    const custoLitro = document.getElementById('custo_litro').value;
    const tagPedagio = document.getElementById('tag_pedagio').value;
    const tagEstacionamento = document.getElementById('tag_estacionamento').value;
    const custosExtras = document.getElementById('custos_extras').value;

    const camposObrigatorios = [nome, placa, modelo];
    if (camposObrigatorios.some(campo => campo === '')) {
        openPopup_v2('Por favor, preencha os campos obrigatórios', 'Campos Obrigatórios', true);
        return;
    }

    const novoMotorista = {
        nome: nome,
        dados_veiculo: {
            placa: placa,
            modelo: modelo,
            status: status
        },
        custo_mensal_veiculo: custoMensal,
        combustível: {
            litros: litros,
            custo_litro: custoLitro,
            custo_total: (Number(litros) * Number(custoLitro.replace('R$ ', '').replace(',', '.'))).toFixed(2)
        },
        pedagio: {
            tag: tagPedagio
        },
        estacionamento: {
            tag: tagEstacionamento
        },
        custos_extras: {
            valor: custosExtras
        }
    };

    const idMotorista = Date.now().toString();
    dados_veiculos.veiculos.mobi.motoristas[idMotorista] = novoMotorista;

    const tbody = document.querySelector('.tabela tbody');
    const campoTotal = document.getElementById('campoTotalMensal');
    preencherTabelaMotoristas('mobi', tbody, campoTotal);

    removerOverlay();
}

async function atualizarListaMotoristas() {
    openPopup_v2(`
        <div style="display: flex; align-items: center; justify-content: left;">
            <img src="gifs/loading.gif" style="width: 50px">
            <label>Aguarde alguns segundos... </label>
        </div>
    `, 'Atualizando lista de motoristas');

    try {
        let dados_veiculos_atuais = await recuperarDados('dados_veiculos') || {};

        await sincronizarDados('dados_veiculos', true);
        let dados_veiculos_novos = await recuperarDados('dados_veiculos');

        const tbody = document.querySelector('#tabelaMotoristas');
        const campoTotal = document.getElementById('campoTotalMensal');

        const veiculoSelecionado = document.querySelector('.veiculos-toolbar-filtro button.selected');
        const nomeVeiculo = veiculoSelecionado ? veiculoSelecionado.textContent.toLowerCase() : Object.keys(dados_veiculos_novos.veiculos)[0];

        if (tbody && campoTotal && nomeVeiculo) {
            preencherTabelaMotoristas(nomeVeiculo);
        }

        removerOverlay();
        remover_popup();

        openPopup_v2(`
            <div style="display: flex; align-items: center; justify-content: center; padding: 20px;">
                <img src="imagens/sucesso.png" style="width: 30px; margin-right: 10px;">
                <label>Lista de motoristas atualizada com sucesso!</label>
            </div>
        `, 'Sucesso');

        setTimeout(() => {
            remover_popup();
        }, 500);

    } catch (error) {
        console.error('Erro ao atualizar lista:', error);
        removerOverlay();
        remover_popup();

        openPopup_v2(`
            <div style="display: flex; align-items: center; justify-content: center; padding: 20px;">
                <img src="imagens/error.png" style="width: 30px; margin-right: 10px;">
                <label>Erro ao atualizar lista de motoristas. Tente novamente.</label>
            </div>
        `, 'Erro');
    }
}