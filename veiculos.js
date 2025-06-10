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

    // Toolbar vertical de veículos
    const toolbar = document.createElement('div');
    toolbar.className = 'veiculos-toolbar-container';

    // Filtro (vertical)
    const filtro = document.createElement('div');
    filtro.className = 'veiculos-toolbar-filtro';

    const labelFiltro = document.createElement('label');
    labelFiltro.textContent = 'Veículos';
    filtro.appendChild(labelFiltro);

    // Área da tabela e do total
    const areaTabela = document.createElement('div');
    areaTabela.className = 'veiculos-area-tabela';

    // Campo do total
    const campoTotal = document.createElement('div');
    campoTotal.id = 'campoTotalMensal';
    campoTotal.className = 'total_geral';
    campoTotal.textContent = 'Total mensal: R$ 0,00';
    areaTabela.appendChild(campoTotal);

    // Tabela
    const tabela = document.createElement('table');
    tabela.className = 'tabela';

    // Cabeçalho
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

    // Corpo da tabela
    const tbody = document.createElement('tbody');
    tabela.appendChild(tbody);

    areaTabela.appendChild(tabela);

    // Adiciona toolbar e tabela ao container
    toolbar.appendChild(filtro);
    toolbar.appendChild(areaTabela);
    container.appendChild(toolbar);

    // Preenche filtro com nomes dos veículos
    const veiculos = dados_veiculos.veiculos;
    Object.keys(veiculos).forEach(nomeVeiculo => {
        const btn = document.createElement('button');
        btn.textContent = nomeVeiculo.toUpperCase();
        btn.onclick = () => {
            preencherTabelaMotoristas(nomeVeiculo, tbody, campoTotal);
            // Destaca o botão selecionado
            Array.from(filtro.querySelectorAll('button')).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        filtro.appendChild(btn);
    });

    // Seleciona o primeiro veículo por padrão
    const primeiroVeiculo = Object.keys(veiculos)[0];
    if (primeiroVeiculo) {
        filtro.querySelector('button').click();
    }
}