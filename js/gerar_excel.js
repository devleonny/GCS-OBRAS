async function ir_excel(orcam_) {
    const orcamento = await recuperarDado('dados_orcamentos', orcam_) || {}

    const wb = new ExcelJS.Workbook()
    const ws_orcamento = wb.addWorksheet('Orçamento')
    const ws_total = wb.addWorksheet('TOTAL')

    const response = await fetch('https://i.imgur.com/5zohUo8.png')
    const imageBlob = await response.blob()
    const reader = new FileReader()
    reader.readAsDataURL(imageBlob)

    reader.onloadend = async () => {
        const base64data = reader.result.replace(/^data:image\/(png|jpg);base64,/, '')
        const imageId = wb.addImage({ base64: base64data, extension: 'png' })

        const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
        const cliente = await recuperarDado('dados_clientes', omie_cliente)
        const nomeArquivo = `${cliente?.nome || '--'} ${orcamento.dados_orcam.contrato}`

        const cabecalho = ['Item', 'Descrição', 'Quantidade', 'Valor Unitário', 'Valor Total']

        const listagem = {}
        for (const [codigo, item] of Object.entries(orcamento?.dados_composicoes || {})) {

            const tipo = item?.tipo || 'OUTROS'
            if (!listagem[tipo]) listagem[tipo] = []

            const qtde = conversor(item.qtde)
            const vl_unit = conversor(item.custo)
            const desconto = conversor(item.desconto) || 0
            const tipoDesconto = (item.tipo_desconto || '').toUpperCase()

            let total
            if (tipoDesconto === 'PORCENTAGEM') {
                total = qtde * vl_unit * (1 - desconto / 100)
            } else {
                total = (qtde * vl_unit) - desconto
            }

            const vlUnitFinal = qtde ? total / qtde : 0

            listagem[tipo].push([
                codigo,
                item.descricao || 'N/A',
                qtde,
                vlUnitFinal,
                total
            ])
        }

        // Cabeçalho principal
        const headerRow = ws_orcamento.addRow(['', `Orçamento: ${nomeArquivo}`])
        ws_orcamento.mergeCells(`B${headerRow.number}:F${headerRow.number}`)
        ws_orcamento.getCell('B1').font = { size: 18, bold: true, color: { argb: '1155CC' } }
        ws_orcamento.getCell('B1').alignment = { horizontal: 'left', vertical: 'middle' }

        ws_orcamento.getCell('G1').value = 'Total:'
        ws_orcamento.getCell('G1').font = { size: 12, bold: true, color: { argb: '1155CC' } }
        ws_orcamento.getCell('G1').alignment = { horizontal: 'right', vertical: 'middle' }

        const intervalosItens = []

        for (const tipo in listagem) {
            ws_orcamento.addRow([])

            const titulo = ws_orcamento.addRow([`${tipo}`])
            titulo.eachCell(c => {
                c.font = { bold: true, color: { argb: 'FFFFFF' }, size: 13 }
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1155CC' } }
                c.alignment = { horizontal: 'center', vertical: 'middle' }
            })

            const head = ws_orcamento.addRow(cabecalho)
            head.eachCell(c => {
                c.font = { bold: true, color: { argb: 'FFFFFF' } }
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }
                c.alignment = { horizontal: 'center', vertical: 'middle' }
            })

            const start = ws_orcamento.lastRow.number + 1

            listagem[tipo].forEach(l => {
                const r = ws_orcamento.addRow(l)
                r.getCell(4).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-'
                r.getCell(5).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-'
            })

            const end = ws_orcamento.lastRow.number
            intervalosItens.push(`E${start}:E${end}`)

            const totalRow = ws_orcamento.addRow([
                '', '', '', `Total ${tipo}`,
                { formula: `SUM(E${start}:E${end})` }
            ])
            totalRow.eachCell(c => {
                c.font = { bold: true, color: { argb: 'FFFFFF' } }
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1155CC' } }
                c.alignment = { horizontal: 'center', vertical: 'middle' }
            })
            totalRow.getCell(5).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-'
        }

        // total geral (somando só as linhas de itens, não os subtotais)
        if (intervalosItens.length) {
            ws_orcamento.getCell('H1').value = { formula: `SUM(${intervalosItens.join(',')})` }
            ws_orcamento.getCell('H1').numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-'
            ws_orcamento.getCell('H1').font = { size: 14, bold: true, color: { argb: '1155CC' } }
            ws_orcamento.getCell('H1').alignment = { horizontal: 'left', vertical: 'middle' }
        }

        // Largura das colunas
        ws_orcamento.columns.forEach((col, i) => {
            col.width = [18, 40, 12, 18, 18][i] || 14
            col.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        })

        // Coluna H é o total;
        ws_orcamento.getColumn('H').width = 35

        // Logo
        ws_orcamento.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 3.25 * 28.35, height: 3.25 * 28.35 }
        })
        ws_orcamento.getRow(1).height = 3 * 28.35

        // --- ABA TOTAL ---
        const escopo = orcamento.dados_orcam.consideracoes || ''
        ws_total.addRows([
            ['', 'Grupo Costa Silva'],
            [],
            ['Orçamento: ' + nomeArquivo]
        ])

        const refs = []
        for (const tipo in listagem) {
            const ultima = ws_orcamento.lastRow.number
            ws_total.addRow([`TOTAL ${tipo}`, { formula: `Orçamento!E${ultima}` }])
            refs.push(`TOTAL!B${ws_total.lastRow.number}`)
        }

        if (refs.length > 1)
            ws_total.addRow(['TOTAL GERAL', { formula: `SUM(${refs.join(',')})` }])

        ws_total.addRows([[], [escopo]])
        ws_total.getColumn(1).width = 25
        ws_total.getColumn(2).width = 25
        ws_total.getColumn(2).numFmt = '_-R$* #,##0.00_-;-R$* #,##0.00_-;_-R$* "-"??_-;_-@_-'
        ws_total.getCell('B1').font = { size: 15, bold: true, color: { argb: '1155CC' } }

        ws_total.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 3.25 * 28.35, height: 3.25 * 28.35 }
        })
        ws_total.getRow(1).height = 3 * 28.35

        ws_total.eachRow(r => r.eachCell(c => c.alignment = { vertical: 'middle', wrapText: true }))

        const buffer = await wb.xlsx.writeBuffer()
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), nomeArquivo + '.xlsx')
    }
}
