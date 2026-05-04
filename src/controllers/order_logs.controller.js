const OrderLogsService = require('../services/order_logs.service');

class OrderLogsController {
    static async getLogsByOrderId(req, res) {
        try {
            const { orderId } = req.params;
            const logs = await OrderLogsService.getLogsByOrderId(orderId);

            res.status(200).json(logs);
        } catch (err) {
            console.error('Error obteniendo bitácora del pedido:', err);
            res.status(err.statusCode || 500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async createLog(req, res) {
        try {
            const { orderId } = req.params;
            const log = await OrderLogsService.createLog(orderId, req.body);

            res.status(201).json({
                status: 'success',
                message: 'Nota interna creada',
                log
            });
        } catch (err) {
            console.error('Error creando nota interna del pedido:', err);
            res.status(err.statusCode || 500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async updateLog(req, res) {
        try {
            const { orderId, logId } = req.params;
            const log = await OrderLogsService.updateLog(orderId, logId, req.body);

            if (!log) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Nota interna no encontrada'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Nota interna actualizada',
                log
            });
        } catch (err) {
            console.error('Error actualizando nota interna del pedido:', err);
            res.status(err.statusCode || 500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async deleteLog(req, res) {
        try {
            const { orderId, logId } = req.params;
            const log = await OrderLogsService.deleteLog(orderId, logId);

            if (!log) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Nota interna no encontrada'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Nota interna eliminada'
            });
        } catch (err) {
            console.error('Error eliminando nota interna del pedido:', err);
            res.status(err.statusCode || 500).json({
                status: 'error',
                message: err.message
            });
        }
    }
}

module.exports = OrderLogsController;
