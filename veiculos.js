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
    tabela.appendChild(tbody);

    areaTabela.appendChild(tabela);

    toolbar.appendChild(filtro);
    toolbar.appendChild(areaTabela);
    container.appendChild(toolbar);

    const veiculos = dados_veiculos.veiculos;
    Object.keys(veiculos).forEach(nomeVeiculo => {
        const btn = document.createElement('button');
        btn.textContent = nomeVeiculo.toUpperCase();
        btn.type = 'button';
        btn.onclick = () => {
            preencherTabelaMotoristas(nomeVeiculo, tbody, campoTotal);
            filtro.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        filtro.appendChild(btn);
    });

    const primeiroVeiculo = Object.keys(veiculos)[0];
    if (primeiroVeiculo) filtro.querySelector('button').click();
}

function preencherTabelaMotoristas(nomeVeiculo, tbody, campoTotal) {
    const veiculo = dados_veiculos.veiculos[nomeVeiculo];
    const motoristas = veiculo.motoristas || {};
    tbody.innerHTML = '';
    let total = 0;

    Object.values(motoristas).forEach(motorista => {
        // Custo mensal (converte para número)
        let custo = motorista.custo_mensal_veiculo || 'R$ 0,00';
        let valor = Number(
            String(custo)
                .replace(/[^\d,]/g, '')
                .replace('.', '')
                .replace(',', '.')
        ) || 0;
        total += valor;

        // Combustível
        let combustivel = motorista.combustível || {};
        let combustivelStr = combustivel.litros
            ? `${combustivel.litros}L x ${combustivel.custo_litro || ''} = ${combustivel.custo_total || ''}`
            : '';

        // Pedágio
        let pedagio = motorista.pedagio || {};
        let pedagioStr = pedagio.tag ? `${pedagio.tag}` : '';

        // Estacionamento
        let estacionamento = motorista.estacionamento || {};
        let estacionamentoStr = estacionamento.tag ? `${estacionamento.tag}` : '';

        // Multas
        let multas = motorista.multas || {};
        let multasStr = Object.keys(multas.anexos || {}).length > 0 ? 'Sim' : 'Não';

        // Custos extras
        let extras = motorista.custos_extras || {};
        let extrasStr = extras.valor || '';

        // Dados do veículo
        let dadosVeiculo = motorista.dados_veiculo || {};
        let dadosVeiculoStr = `
            Placa: ${dadosVeiculo.placa || ''}<br>
            Modelo: ${dadosVeiculo.modelo || ''}<br>
            Status: ${dadosVeiculo.status || ''}
        `;

        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${motorista.nome || ''}</td>
                <td>${dadosVeiculoStr}</td>
                <td>${motorista.custo_mensal_veiculo || ''}</td>
                <td>${combustivelStr}</td>
                <td>${pedagioStr}</td>
                <td>${estacionamentoStr}</td>
                <td>${multasStr}</td>
                <td>${extrasStr}</td>
            </tr>
        `);
    });

    campoTotal.textContent = `Total mensal: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}