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

    var total_venda = 0;
    var total_servico = 0;

    reader.onloadend = () => {
        const base64data = reader.result.replace(/^data:image\/(png|jpg);base64,/, '');

        const imageId = wb.addImage({
            base64: base64data,
            extension: 'png',
        });

        let estado = `${orcamento.dados_orcam.estado}`
        let nome_arquivo = `${orcamento.dados_orcam.cliente_selecionado} ${orcamento.dados_orcam.contrato}`
        let REF;

        if (orcamento['lpu_ativa']) {
            REF = String(orcamento['lpu_ativa']).split('LPU ')[1]
        } else {
            REF = 'CARREFOUR'
        }

        var venda_headers;
        var servico_headers;

        if (REF == 'CARREFOUR') {
            venda_headers = [
                ['Item', 'SAP ID', 'REF ID', "NCM", "Descrição", "Quantidade", "Valor Unit Liq", "Valor Total Liq", "%ICMS", "Valor UNIT", "Valor Total"]
            ];
            servico_headers = [
                ['Item', 'SAP ID', 'REF ID', "NCM", "Descrição", "Quantidade", "Valor UNIT", "Valor Total"]
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

        Object.keys(orcamento.dados_composicoes).forEach(it => {
            var item = orcamento.dados_composicoes[it]
            var unit_ = conversor(item.custo);
            var total_ = conversor(item.total);
            let valor_unit_liq = item.tipo == "VENDA" ? unit_ - (unit_ * (estado == 'BA' ? 0.205 : 0.12)) : unit_;
            let valor_total_liq = item.tipo == "VENDA" ? total_ - (total_ * (estado == 'BA' ? 0.205 : 0.12)) : total_;
            let porcent_icms = item.tipo == "VENDA" ? (estado == 'BA' ? '20,5%' : '12%') : '0%';


            if (REF == 'CARREFOUR') {

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
                        item.descricao,
                        Number(item.qtde).toFixed(2).replace('.', ','),
                        valor_unit_liq,
                        valor_total_liq,
                        porcent_icms,
                        unit_,
                        total_
                    ]);
                    total_venda += total_;
                } else {
                    servico_data.push([
                        item.codigo,
                        sapId,
                        refId,
                        item.ncm,
                        item.descricao,
                        Number(item.qtde).toFixed(2).replace('.', ','),
                        unit_,
                        total_
                    ]);
                    total_servico += total_;
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
                        Number(item.qtde).toFixed(2).replace('.', ','),
                        valor_unit_liq,
                        valor_total_liq,
                        porcent_icms,
                        unit_,
                        total_
                    ]);
                    total_venda += total_;
                } else {
                    servico_data.push([
                        item.codigo,
                        item.ncm,
                        item.descricao,
                        Number(item.qtde).toFixed(2).replace('.', ','),
                        unit_,
                        total_
                    ]);
                    total_servico += total_;
                }
            }
        });

        ws_orcamento.addRow(['', 'Orçamento: ' + nome_arquivo + ' - TOTAL: ' + orcamento['total_geral']]);

        if (servico_data.length !== 0) {

            ws_orcamento.addRows(servico_headers);
            ws_orcamento.addRows(servico_data);

            if (REF == 'CARREFOUR') {
                ws_orcamento.addRow(['', '', '', '', '', '', 'Total Serviço', total_servico]);
            } else {
                ws_orcamento.addRow(['', '', '', '', 'Total Serviço', total_servico]);
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

            if (REF == 'CARREFOUR') {
                ws_orcamento.addRow(['', '', '', '', '', '', '', '', '', 'Total Venda', total_venda]);
            } else {
                ws_orcamento.addRow(['', '', '', '', '', '', '', 'Total Venda', total_venda]);
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



        if (REF == 'CARREFOUR') {
            ['G', 'H', 'J', 'K'].forEach(col => {
                ws_orcamento.getColumn(col).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';
            });

            ws_orcamento.getColumn(6).eachCell({ includeEmpty: true }, function (cell) {
                cell.alignment = { horizontal: 'center' };
            });

        } else {
            ['E', 'F', 'G', 'H', 'I'].forEach(col => {
                ws_orcamento.getColumn(col).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-';
            });
            ws_orcamento.getColumn(4).eachCell({ includeEmpty: true }, function (cell) {
                cell.alignment = { horizontal: 'center' };
            });
        }

        ws_orcamento.columns.forEach(column => {
            if (column._number == 5 && REF == 'CARREFOUR') {
                column.width = 50;
            } else if (column._number == 3 && REF != 'CARREFOUR') {
                column.width = 50;
            } else {
                column.width = 14;
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

        var escopo = orcamento['dados_orcam'].consideracoes;

        var ws_total_data = [
            ['', 'Grupo Costa Silva'],
            [],
            ['Orçamento: ' + nome_arquivo],
            ["TOTAL DE VENDA", total_venda],
            ["TOTAL DE SERVIÇO", total_servico],
            ["TOTAL GERAL", total_venda + total_servico],
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

        wb.xlsx.writeBuffer().then(function (buffer) {
            saveAs(new Blob([buffer], { type: 'application/octet-stream' }), nome_arquivo + '.xlsx');
        });
    };
}