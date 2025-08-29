const { getPrismaClient } = require('../utils/database');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Admin: Create new payment method
exports.createPaymentMethod = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { 
      name, 
      type, 
      accountName, 
      accountNumber, 
      bankName, 
      sortOrder = 0 
    } = req.body;

    // Validate required fields
    if (!name || !type || !accountName || !accountNumber) {
      return res.status(400).json({ 
        error: 'Name, type, account name, and account number are required.' 
      });
    }

    // Validate type
    const validTypes = ['mobile_money', 'bank_transfer', 'cash'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be one of: mobile_money, bank_transfer, cash' 
      });
    }

    // Check if payment method with same name already exists
    const existingMethod = await prisma.paymentMethod.findFirst({
      where: { name }
    });

    if (existingMethod) {
      return res.status(409).json({ 
        error: 'Payment method with this name already exists.' 
      });
    }

    // Create payment method
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        name,
        type,
        accountName,
        accountNumber,
        bankName,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive: true
      }
    });

    res.status(201).json({
      message: 'Payment method created successfully',
      paymentMethod
    });

  } catch (err) {
    console.error('Create payment method error:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment method.' });
  }
};

// Admin: Get all payment methods
exports.getAllPaymentMethods = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { active } = req.query;

    const whereClause = {};
    if (active !== undefined) {
      whereClause.isActive = active === 'true';
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: whereClause,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      paymentMethods,
      total: paymentMethods.length
    });

  } catch (err) {
    console.error('Get payment methods error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch payment methods.' });
  }
};

// Admin: Get active payment methods (for public use)
exports.getActivePaymentMethods = async (req, res) => {
  try {
    const prisma = await initPrisma();

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        type: true,
        accountName: true,
        accountNumber: true,
        bankName: true
      }
    });

    res.json({
      paymentMethods,
      total: paymentMethods.length
    });

  } catch (err) {
    console.error('Get active payment methods error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch payment methods.' });
  }
};

// Admin: Update payment method
exports.updatePaymentMethod = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { id } = req.params;
    const { 
      name, 
      type, 
      accountName, 
      accountNumber, 
      bankName, 
      isActive, 
      sortOrder 
    } = req.body;

    // Check if payment method exists
    const existingMethod = await prisma.paymentMethod.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!existingMethod) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['mobile_money', 'bank_transfer', 'cash'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ 
          error: 'Invalid type. Must be one of: mobile_money, bank_transfer, cash' 
        });
      }
    }

    // Check for name conflict if name is being changed
    if (name && name !== existingMethod.name) {
      const nameConflict = await prisma.paymentMethod.findFirst({
        where: { 
          name,
          id: { not: parseInt(id, 10) }
        }
      });

      if (nameConflict) {
        return res.status(409).json({ 
          error: 'Payment method with this name already exists.' 
        });
      }
    }

    // Update payment method
    const updatedMethod = await prisma.paymentMethod.update({
      where: { id: parseInt(id, 10) },
      data: {
        name: name || undefined,
        type: type || undefined,
        accountName: accountName || undefined,
        accountNumber: accountNumber || undefined,
        bankName: bankName !== undefined ? bankName : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : undefined
      }
    });

    res.json({
      message: 'Payment method updated successfully',
      paymentMethod: updatedMethod
    });

  } catch (err) {
    console.error('Update payment method error:', err);
    res.status(500).json({ error: err.message || 'Failed to update payment method.' });
  }
};

// Admin: Delete payment method
exports.deletePaymentMethod = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { id } = req.params;

    // Check if payment method exists
    const existingMethod = await prisma.paymentMethod.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!existingMethod) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    // Check if payment method is being used
    const paymentsUsingMethod = await prisma.payment.count({
      where: { paymentMethodId: parseInt(id, 10) }
    });

    if (paymentsUsingMethod > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete payment method. It is being used by existing payments.' 
      });
    }

    // Delete payment method
    await prisma.paymentMethod.delete({
      where: { id: parseInt(id, 10) }
    });

    res.json({
      message: 'Payment method deleted successfully'
    });

  } catch (err) {
    console.error('Delete payment method error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete payment method.' });
  }
};

// Admin: Toggle payment method status
exports.togglePaymentMethodStatus = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { id } = req.params;

    // Check if payment method exists
    const existingMethod = await prisma.paymentMethod.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!existingMethod) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    // Toggle status
    const updatedMethod = await prisma.paymentMethod.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: !existingMethod.isActive }
    });

    res.json({
      message: `Payment method ${updatedMethod.isActive ? 'activated' : 'deactivated'} successfully`,
      paymentMethod: updatedMethod
    });

  } catch (err) {
    console.error('Toggle payment method status error:', err);
    res.status(500).json({ error: err.message || 'Failed to toggle payment method status.' });
  }
};

// Admin: Reorder payment methods
exports.reorderPaymentMethods = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { order } = req.body; // Array of {id, sortOrder}

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Order array is required.' });
    }

    // Update sort order for each payment method
    const updatePromises = order.map(item => 
      prisma.paymentMethod.update({
        where: { id: parseInt(item.id, 10) },
        data: { sortOrder: parseInt(item.sortOrder, 10) }
      })
    );

    await Promise.all(updatePromises);

    res.json({
      message: 'Payment methods reordered successfully'
    });

  } catch (err) {
    console.error('Reorder payment methods error:', err);
    res.status(500).json({ error: err.message || 'Failed to reorder payment methods.' });
  }
};
