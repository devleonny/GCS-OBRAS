async function ir_excel(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let orcamento = dados_orcamentos[orcam_]

    var wb = new ExcelJS.Workbook();
    var ws_orcamento = wb.addWorksheet('Orçamento');
    var ws_total = wb.addWorksheet('TOTAL');

    const response = await fetch('https://i.postimg.cc/dQHpVMK6/IMG-Nb8s-Ps0.png');
    const imageBlob = await response.blob();
    const reader = new FileReader();
    reader.readAsDataURL(imageBlob);

    reader.onloadend = () => {
        const base64data = reader.result.replace(/^data:image\/(png|jpg);base64,/, '');

        const imageId = wb.addImage({
            base64: base64data,
            extension: 'png',
        });

        let omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
        let cliente = dados_clientes?.[omie_cliente] || {}
        let estado = cliente?.estado || ''
        let nome_arquivo = `${cliente?.nome || '--'} ${orcamento.dados_orcam.contrato}`
        let carrefour = orcamento.lpu_ativa == 'LPU CARREFOUR' ? true : false
        var venda_headers;
        var servico_headers;

        if (carrefour) {
            venda_headers = [
                ['Item', 'SAP ID', 'REF ID', "NCM", 'Descrição Real', "Descrição Carrefour", "Quantidade", "Valor Unit Liq", "Valor Total Liq", "%ICMS", "Valor UNIT", "Valor Total"]
            ];
            servico_headers = [
                ['Item', 'SAP ID', 'REF ID', "NCM", 'Descrição Real', "Descrição Carrefour", "Quantidade", "Valor UNIT", "Valor Total"]
            ];
        } else {
            venda_headers = [
                ['Item', "NCM", "Descrição", "Quantidade", "Valor Unit Liq", "Valor Total Liq", "%ICMS", "Valor UNIT", "Valor Total"]
            ];
            servico_headers = [
                ['Item', "NCM", "Descrição", "Quantidade", "Valor UNIT", "Valor Total"]
            ];
        }

        let listagem = {
            VENDA: [],
            SERVIÇO: []
        }

        for (tabela in listagem) {

            for (it in orcamento.dados_composicoes) {

                let item = orcamento.dados_composicoes[it]
                item.tipo = item.tipo ? item.tipo : dados_composicoes[item.codigo].tipo

                if (item.tipo == 'USO E CONSUMO') item.tipo = 'SERVIÇO'

                if (item.tipo !== tabela) {
                    continue
                }

                item.qtde = conversor(item.qtde)
                var vl_unitario = conversor(item.custo)
                let porcent_icms = 0

                if (carrefour) {

                    let descricao_real = dados_composicoes[item.codigo].descricao // REAL

                    if (dados_composicoes[item.codigo] && dados_composicoes[item.codigo].substituto) {
                        item.codigo = dados_composicoes[item.codigo].substituto
                    }

                    item.descricao = dados_composicoes[item.codigo].descricaocarrefour
                    item.ncm = dados_composicoes[item.codigo].ncm
                    var sapId = dados_composicoes[item.codigo].sapid
                    var refId = dados_composicoes[item.codigo].refid

                    if (item.tipo == 'VENDA') {
                        porcent_icms = estado == 'BA' ? 0.205 : 0.12

                        listagem[tabela].push([
                            item.codigo,
                            sapId,
                            refId,
                            item.ncm,
                            descricao_real,
                            item.descricao,
                            item.qtde,
                            { formula: `K@*(1-J@)` },
                            { formula: `G@*H@` },
                            porcent_icms,
                            vl_unitario,
                            { formula: `G@*K@` }
                        ]);
                    } else if (item.tipo == 'SERVIÇO') {
                        listagem[tabela].push([
                            item.codigo,
                            sapId,
                            refId,
                            item.ncm,
                            descricao_real,
                            item.descricao,
                            item.qtde,
                            vl_unitario,
                            { formula: `G@*H@` }
                        ]);
                    }

                } else { // No caso de serem outras tabelas;

                    if (dados_composicoes[item.codigo]) {
                        item.ncm = dados_composicoes[item.codigo].ncm
                        item.descricao = dados_composicoes[item.codigo].descricao
                    }

                    if (item.tipo == 'VENDA') {
                        porcent_icms = estado == 'BA' ? 0.205 : 0.12
                        listagem[tabela].push([
                            item.codigo,
                            item.ncm,
                            item.descricao,
                            item.qtde,
                            { formula: `H@*(1-G@)` },
                            { formula: `D@*E@` },
                            porcent_icms,
                            vl_unitario,
                            { formula: `D@*H@` }
                        ]);
                    } else if (item.tipo == 'SERVIÇO') {
                        listagem[tabela].push([
                            item.codigo,
                            item.ncm,
                            item.descricao,
                            item.qtde,
                            vl_unitario,
                            { formula: `D@*E@` }
                        ]);
                    }
                }

            }

        }

        let headerRow = ws_orcamento.addRow(['', `Orçamento: ${nome_arquivo}`]);
        ws_orcamento.mergeCells(`B${headerRow.number}:G${headerRow.number}`)
        ws_orcamento.mergeCells(`H${headerRow.number}:J${headerRow.number}`)

        if (listagem.SERVIÇO.length !== 0) {

            ws_orcamento.addRows(servico_headers);

            listagem.SERVIÇO.forEach(linha => {
                linha.forEach(celula => {
                    if (dicionario(celula) && celula.formula) {
                        celula.formula = celula.formula.replace(/@/g, 1 + ws_orcamento.lastRow.number);
                    }
                })
                ws_orcamento.addRow(linha);
            })

            if (carrefour) {
                ws_orcamento.addRow(['', '', '', '', '', '', '', 'Total Serviço', { formula: `SUM(I${1 + ws_orcamento.lastRow.number - listagem.SERVIÇO.length}:I${ws_orcamento.lastRow.number})` }]);
            } else {
                ws_orcamento.addRow(['', '', '', '', 'Total Serviço', { formula: `SUM(F${1 + ws_orcamento.lastRow.number - listagem.SERVIÇO.length}:F${ws_orcamento.lastRow.number})` }]);
            }

            ws_orcamento.getRow(ws_orcamento.lastRow.number).eachCell((cell) => {
                cell.font = {
                    bold: true,
                    color: { argb: 'FFFFFF' }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF008000' }
                };
            });

            ws_orcamento.getRow(ws_orcamento.lastRow.number - listagem.SERVIÇO.length - 1).eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF008000' }
                };
                cell.font = {
                    bold: true,
                    color: { argb: 'FFFFFF' }
                };
            });
        }

        if (listagem.VENDA.length !== 0) {
            if (listagem.SERVIÇO.length !== 0) {
                ws_orcamento.addRow([]);
            }

            ws_orcamento.addRows(venda_headers);

            listagem.VENDA.forEach(linha => {
                linha.forEach(celula => {
                    if (dicionario(celula) && celula.formula) {
                        celula.formula = celula.formula.replace(/@/g, 1 + ws_orcamento.lastRow.number);
                    }
                })
                ws_orcamento.addRow(linha);
            })

            if (carrefour) {
                ws_orcamento.addRow(['', '', '', '', '', '', '', '', '', '', 'Total Venda', { formula: `SUM(L${1 + ws_orcamento.lastRow.number - listagem.VENDA.length}:L${ws_orcamento.lastRow.number})` }]);
            } else {
                ws_orcamento.addRow(['', '', '', '', '', '', '', 'Total Venda', { formula: `SUM(I${1 + ws_orcamento.lastRow.number - listagem.VENDA.length}:I${ws_orcamento.lastRow.number})` }]);
            }

            ws_orcamento.getRow(ws_orcamento.lastRow.number).eachCell((cell) => {
                cell.font = {
                    bold: true,
                    color: { argb: 'FFFFFF' }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFB12425' }
                };
            });

            ws_orcamento.getRow(ws_orcamento.lastRow.number - listagem.VENDA.length - 1).eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFB12425' }
                };
                cell.font = {
                    bold: true,
                    color: { argb: 'FFFFFF' }
                };
            });
        }

        // Formatação das colunas
        if (carrefour) {
            ['H', 'I', 'K', 'L'].forEach(col => {
                ws_orcamento.getColumn(col).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';
            });
            ws_orcamento.getColumn('J').numFmt = '0.00%';
        } else {
            ['E', 'F', 'G', 'H', 'I'].forEach(col => {
                ws_orcamento.getColumn(col).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';
            });
            ws_orcamento.getColumn('G').numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';
            ws_orcamento.getColumn(4).eachCell({ includeEmpty: true }, function (cell) {
                cell.alignment = { horizontal: 'center' };
            });
        }

        ws_orcamento.columns.forEach(column => {
            if ((column._number == 5 || column._number == 6) && carrefour) {
                column.width = 40;
            } else if (column._number == 3 && !carrefour) {
                column.width = 40;
            } else {
                column.width = 14;
                ws_orcamento.getColumn(column._number).eachCell({ includeEmpty: true }, (cell) => {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            }
        });

        ws_orcamento.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 3.25 * 28.35, height: 3.25 * 28.35 }
        });

        ws_orcamento.getRow(1).height = 3 * 28.35;

        let estiloHeader = {
            font: {
                size: 20,
                color: { argb: '1155CC' },
                bold: true
            },
            alignment: {
                horizontal: 'left',
                vertical: 'middle'
            }
        };

        ws_orcamento.getCell('B1').font = estiloHeader.font;
        ws_orcamento.getCell('B1').alignment = estiloHeader.alignment;

        ws_orcamento.getCell('H1').font = estiloHeader.font;
        ws_orcamento.getCell('H1').alignment = estiloHeader.alignment;
        ws_orcamento.getCell('H1').numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';

        let escopo = orcamento.dados_orcam.consideracoes;
        let col_serviço = carrefour ? 'I' : 'F'
        let col_venda = carrefour ? 'L' : 'I'

        ws_total.addRows([['', 'Grupo Costa Silva']])

        ws_total.addRows([[],
        ['Orçamento: ' + nome_arquivo]])

        let manter_total = 0
        let fct = 4 // limite da até onde a célula receberá formatação (A4 a A6)

        let refsTotais = [];

        if (listagem.SERVIÇO.length !== 0) {
            const rowServiço = ws_total.lastRow.number + 1;
            ws_total.addRows([
                ["TOTAL DE SERVIÇO", { formula: `SUM(Orçamento!${col_serviço}3:${col_serviço}${3 + listagem.SERVIÇO.length - 1})` }]
            ]);
            refsTotais.push(`TOTAL!B${rowServiço}`);
            manter_total++;
        }

        if (listagem.VENDA.length !== 0) {
            const rowVenda = ws_total.lastRow.number + 1;
            ws_total.addRows([
                ["TOTAL DE VENDA", { formula: `SUM(Orçamento!${col_venda}${ws_orcamento.lastRow.number - listagem.VENDA.length}:${col_venda}${ws_orcamento.lastRow.number - 1})` }]
            ]);
            refsTotais.push(`TOTAL!B${rowVenda}`);
            manter_total++;
        }

        if (refsTotais.length) {
            ws_orcamento.getCell(`H1`).value = { formula: `SUM(${refsTotais.join(",")})` };
        }

        if (manter_total == 2) {
            ws_total.addRow(["TOTAL", { formula: `SUM(B4:B5)` }])
            fct = 6
        } else {
            ws_total.addRows([[], []])
        }

        ws_total.addRows([
            [],
            [escopo]])

        const gcs_nome = ws_total.getCell('B1');
        gcs_nome.font = {
            size: 15,
            color: { argb: '1155CC' },
            bold: true
        };

        gcs_nome.alignment = {
            horizontal: 'left',
            vertical: 'middle'
        };

        const headerCell2 = ws_total.getCell('A3');
        headerCell2.font = {
            size: 15,
            color: { argb: '1155CC' },
            bold: true
        };
        headerCell2.alignment = {
            horizontal: 'left',
            vertical: 'middle'
        };

        ws_total.getColumn(1).width = 20;
        ws_total.getColumn(2).width = 20;
        ws_total.getColumn(2).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';

        ws_total.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 3.25 * 28.35, height: 3.25 * 28.35 }
        });

        ws_total.getRow(1).height = 3 * 28.35;

        for (let i = 4; i <= fct; i++) {
            let cell = ws_total.getCell('A' + i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '1155CC' }
            };
            cell.font = {
                bold: true,
                color: { argb: 'FFFFFF' }
            };
        }

        ws_total.mergeCells('A8:H100');
        ws_total.getCell('A8').alignment = {
            vertical: 'top',
            wrapText: true
        };

        ws_orcamento.eachRow((row) => {
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', wrapText: true };
            });
        });

        wb.xlsx.writeBuffer().then(function (buffer) {
            saveAs(new Blob([buffer], { type: 'application/octet-stream' }), nome_arquivo + '.xlsx');
        });
    };
}