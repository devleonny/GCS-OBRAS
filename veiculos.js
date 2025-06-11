const dados_veiculos = {
    "veiculos": {
        "mobi": {
            "frotas": {
                "AAA-1111": {
                    "codigo": "123456",
                    "placa": "AAA-1111",
                    "modelo": "Mobi Like",
                    "status": "locado ou devolvido"
                }
            },
            "motoristas": {
                "12345": {
                    "nome": "Jhon Dow",
                    "dados_veiculo": {
                        "placa": "AAA-1111",
                        "modelo": "Mobi Like",
                        "status": "locado ou devolvido"
                    },
                    "custo_mensal_veiculo": "R$ 1.000,00",
                    "combustível": {
                        "litros": "100",
                        "custo_litro": "R$ 5,00",
                        "custo_total": "R$ 500,00",
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
                        "valor": "R$ 100,00",
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
                    "status": "locado ou devolvido"
                }
            },
            "motoristas": {
                "12345": {
                    "nome": "Jane Doe",
                    "dados_veiculo": {
                        "placa": "AAA-1111",
                        "modelo": "Mobi Like",
                        "status": "locado ou devolvido"
                    },
                    "custo_mensal_veiculo": "R$ 5.000,00",
                    "combustível": {
                        "litros": "100",
                        "custo_litro": "R$ 5,00",
                        "custo_total": "R$ 500,00",
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
                        "valor": "R$ 100,00",
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

    container.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'veiculos-toolbar-container';

    const filtro = document.createElement('div');
    filtro.className = 'veiculos-toolbar-filtro';

    const labelFiltro = document.createElement('label');
    labelFiltro.textContent = 'Veículos';
    filtro.appendChild(labelFiltro);

    const areaTabela = document.createElement('div');
    areaTabela.className = 'veiculos-area-tabela';

    const campoTotal = document.createElement('div');
    campoTotal.id = 'campoTotalMensal';
    campoTotal.className = 'total_geral';
    campoTotal.textContent = 'Total mensal: R$ 0,00';
    areaTabela.appendChild(campoTotal);

    // Cria a tabela e seus elementos
    const tabela = document.createElement('table');
    tabela.className = 'tabela';

    const thead = document.createElement('thead');
    thead.className = 'ths';
    thead.innerHTML = `
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
    `;
    tabela.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'tabelaMotoristas'; // Adiciona ID para referência
    tabela.appendChild(tbody);

    // Cria o botão de cadastro
    const btnCadastro = document.createElement('button');
    btnCadastro.className = 'botao-cadastro-motorista';
    btnCadastro.textContent = 'Cadastrar Novo Motorista';
    btnCadastro.onclick = abrirFormularioCadastro;

    // Adiciona os elementos na ordem correta
    areaTabela.appendChild(btnCadastro);
    areaTabela.appendChild(tabela);

    toolbar.appendChild(filtro);
    toolbar.appendChild(areaTabela);
    container.appendChild(toolbar);

    // Cria os botões de filtro
    const veiculos = dados_veiculos.veiculos;
    Object.keys(veiculos).forEach(nomeVeiculo => {
        const btn = document.createElement('button');
        btn.textContent = nomeVeiculo.toUpperCase();
        btn.type = 'button';
        btn.onclick = () => {
            preencherTabelaMotoristas(nomeVeiculo);
            filtro.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        filtro.appendChild(btn);
    });

    // Seleciona o primeiro veículo por padrão
    if (Object.keys(veiculos).length > 0) {
        filtro.querySelector('button').click();
    }
}

function preencherTabelaMotoristas(nomeVeiculo) {
    const tbody = document.getElementById('tabelaMotoristas');
    const campoTotal = document.getElementById('campoTotalMensal');
    const veiculo = dados_veiculos.veiculos[nomeVeiculo];

    if (!tbody || !veiculo || !veiculo.motoristas) return;

    tbody.innerHTML = '';
    let total = 0;

    Object.entries(veiculo.motoristas).forEach(([id, motorista]) => {
        const custoMensal = motorista.custo_mensal_veiculo || 'R$ 0,00';
        const valor = Number(custoMensal.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        total += valor;

        const combustivel = motorista.combustível || {};
        const pedagio = motorista.pedagio || {};
        const estacionamento = motorista.estacionamento || {};
        const multas = motorista.multas || {};
        const extras = motorista.custos_extras || {};

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${motorista.nome || ''}</td>
            <td>
                Placa: ${motorista.dados_veiculo?.placa || ''}<br>
                Modelo: ${motorista.dados_veiculo?.modelo || ''}<br>
                Status: ${motorista.dados_veiculo?.status || ''}
            </td>
            <td>${custoMensal}</td>
            <td>${combustivel.litros ? `${combustivel.litros}L x ${combustivel.custo_litro} = ${combustivel.custo_total}` : ''}</td>
            <td>${pedagio.tag || ''}</td>
            <td>${estacionamento.tag || ''}</td>
            <td>${Object.keys(multas.anexos || {}).length ? 'Sim' : 'Não'}</td>
            <td>${extras.valor || ''}</td>
        `;
    });

    if (campoTotal) {
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
                <input type="text" id="nome_motorista">
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

function cadastrarMotorista() {
    // Captura os valores do formulário
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

    // Valida campos obrigatórios
    if (!nome || !placa || !modelo) {
        alert('Por favor, preencha os campos obrigatórios');
        return;
    }

    // Cria objeto com dados do motorista
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

    // Adiciona o motorista aos dados
    const idMotorista = Date.now().toString();
    dados_veiculos.veiculos.mobi.motoristas[idMotorista] = novoMotorista;

    // Atualiza a tabela
    const tbody = document.querySelector('.tabela tbody');
    const campoTotal = document.getElementById('campoTotalMensal');
    preencherTabelaMotoristas('mobi', tbody, campoTotal);

    // Fecha o popup
    removerOverlay();
}

function atualizarListaMotoristas() {
    const tbody = document.querySelector('.tabela tbody');
    const campoTotal = document.getElementById('campoTotalMensal');
    preencherTabelaMotoristas('mobi', tbody, campoTotal);
}