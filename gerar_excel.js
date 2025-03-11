async function ir_excel(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[orcam_]

    var wb = new ExcelJS.Workbook();
    var ws_orcamento = wb.addWorksheet('Orçamento');
    var ws_total = wb.addWorksheet('TOTAL');

    const response = await fetch('https://i.imgur.com/Nb8sPs0.png');
    const imageBlob = await response.blob();
    const reader = new FileReader();
    reader.readAsDataURL(imageBlob);

    reader.onloadend = () => {
        const base64data = reader.result.replace(/^data:image\/(png|jpg);base64,/, '');

        const imageId = wb.addImage({
            base64: base64data,
            extension: 'png',
        });

        let estado = `${orcamento.dados_orcam.estado}`
        let nome_arquivo = `${orcamento.dados_orcam.cliente_selecionado} ${orcamento.dados_orcam.contrato}`
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

        var venda_data = [];
        var servico_data = [];
        let linha = 3
        let tabelas = ['SERVIÇO', 'VENDA']

        tabelas.forEach(tabela => {

            for (it in orcamento.dados_composicoes) {

                var item = orcamento.dados_composicoes[it]
                if (item.tipo !== tabela) {
                    continue
                }

                item.qtde = conversor(item.qtde)
                var vl_unitario = conversor(item.custo)
                let porcent_icms = item.tipo == "VENDA" ? (estado == 'BA' ? 0.205 : 0.12) : 0; // ICMS como número

                if (carrefour) {
                    let descricao_real = dados_composicoes[item.codigo].descricao // REAL

                    if (dados_composicoes[item.codigo] && dados_composicoes[item.codigo].substituto) {
                        item.codigo = dados_composicoes[item.codigo].substituto
                    }

                    item.tipo = dados_composicoes[item.codigo].tipo
                    item.descricao = dados_composicoes[item.codigo].descricaocarrefour
                    item.ncm = dados_composicoes[item.codigo].ncm
                    var sapId = dados_composicoes[item.codigo].sapid
                    var refId = dados_composicoes[item.codigo].refid

                    if (item.tipo == 'VENDA') {
                        venda_data.push([
                            item.codigo,
                            sapId,
                            refId,
                            item.ncm,
                            descricao_real,
                            item.descricao,
                            item.qtde,
                            { formula: `K${linha}*(1-J${linha})` },
                            { formula: `G${linha}*H${linha}` },
                            porcent_icms,
                            vl_unitario,
                            { formula: `G${linha}*K${linha}` }
                        ]);
                    } else {
                        servico_data.push([
                            item.codigo,
                            sapId,
                            refId,
                            item.ncm,
                            descricao_real,
                            item.descricao,
                            item.qtde,
                            vl_unitario,
                            { formula: `G${linha}*H${linha}` }
                        ]);
                    }

                } else { // No caso de serem outras tabelas;

                    if (dados_composicoes[item.codigo]) {
                        item.ncm = dados_composicoes[item.codigo].ncm
                        item.descricao = dados_composicoes[item.codigo].descricao
                    }

                    if (item.tipo == 'VENDA') {
                        venda_data.push([
                            item.codigo,
                            item.ncm,
                            item.descricao,
                            item.qtde,
                            { formula: `H${linha}*(1-G${linha})` },
                            { formula: `D${linha}*E${linha}` },
                            porcent_icms,
                            vl_unitario,
                            { formula: `D${linha}*H${linha}` }
                        ]);
                    } else {
                        servico_data.push([
                            item.codigo,
                            item.ncm,
                            item.descricao,
                            item.qtde,
                            vl_unitario,
                            { formula: `D${linha}*E${linha}` }
                        ]);
                    }
                }

                linha++

            }

            if (linha !== 3) {
                linha += 3
            }
        })

        let headerRow = ws_orcamento.addRow(['', 'Orçamento: ' + nome_arquivo + ' - TOTAL: ' + orcamento.total_geral]);
        ws_orcamento.mergeCells(`B${headerRow.number}:O${headerRow.number}`);

        if (servico_data.length !== 0) {
            ws_orcamento.addRows(servico_headers);
            ws_orcamento.addRows(servico_data);

            if (carrefour) {
                ws_orcamento.addRow(['', '', '', '', '', '', '', 'Total Serviço', { formula: `SUM(I${1 + ws_orcamento.lastRow.number - servico_data.length}:I${ws_orcamento.lastRow.number})` }]);
            } else {
                ws_orcamento.addRow(['', '', '', '', '', 'Total Serviço', { formula: `SUM(F${1 + ws_orcamento.lastRow.number - servico_data.length}:F${ws_orcamento.lastRow.number})` }]);
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

            ws_orcamento.getRow(ws_orcamento.lastRow.number - servico_data.length - 1).eachCell((cell) => {
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

        if (venda_data.length !== 0) {
            if (servico_data.length !== 0) {
                ws_orcamento.addRow([]);
            }

            ws_orcamento.addRows(venda_headers);
            ws_orcamento.addRows(venda_data);

            if (carrefour) {
                ws_orcamento.addRow(['', '', '', '', '', '', '', '', '', '', 'Total Venda', { formula: `SUM(L${1 + ws_orcamento.lastRow.number - venda_data.length}:L${ws_orcamento.lastRow.number})` }]);
            } else {
                ws_orcamento.addRow(['', '', '', '', '', '', '', 'Total Venda', { formula: `SUM(I${1 + ws_orcamento.lastRow.number - venda_data.length}:I${ws_orcamento.lastRow.number})` }]);
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

            ws_orcamento.getRow(ws_orcamento.lastRow.number - venda_data.length - 1).eachCell((cell) => {
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
            ws_orcamento.getColumn('J').numFmt = '0.00%'; // Formata %ICMS como porcentagem
        } else {
            ['E', 'F', 'G', 'H', 'I'].forEach(col => {
                ws_orcamento.getColumn(col).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';
            });
            ws_orcamento.getColumn('G').numFmt = '0.00%'; // Formata %ICMS como porcentagem
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

        const headerCell = ws_orcamento.getCell('B1');
        headerCell.font = {
            size: 28,
            color: { argb: '1155CC' },
            bold: true
        };
        headerCell.alignment = {
            horizontal: 'left',
            vertical: 'middle'
        };

        var escopo = orcamento.dados_orcam.consideracoes;

        var ws_total_data = [
            ['', 'Grupo Costa Silva'],
            [],
            ['Orçamento: ' + nome_arquivo],
            ["TOTAL DE VENDA", { formula: `SUM(Orçamento!L${ws_orcamento.lastRow.number - venda_data.length}:L${ws_orcamento.lastRow.number})` }],
            ["TOTAL DE SERVIÇO", { formula: `SUM(Orçamento!I${ws_orcamento.lastRow.number - servico_data.length}:I${ws_orcamento.lastRow.number})` }],
            ["TOTAL GERAL", { formula: `SUM(B4:B5)` }],
            [],
            [escopo]
        ];

        ws_total.addRows(ws_total_data);

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

        for (let i = 4; i <= 6; i++) {
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

        ws_total.mergeCells('A8:H18');
        ws_total.getCell('A8').alignment = {
            vertical: 'middle',
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