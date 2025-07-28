import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    // Today's revenue
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
        paymentStatus: "PAID",
      },
    });

    const todayRevenue = todayOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

    // Yesterday's revenue for comparison
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfYesterday,
          lt: startOfDay,
        },
        paymentStatus: "PAID",
      },
    });

    const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

    // Total orders today
    const totalOrders = todayOrders.length;
    const totalOrdersYesterday = yesterdayOrders.length;

    // Pending orders
    const pendingOrders = await prisma.order.count({
      where: {
        status: "PENDING",
      },
    });

    // Previous day pending orders
    const pendingOrdersYesterday = await prisma.order.count({
      where: {
        status: "PENDING",
        createdAt: {
          gte: startOfYesterday,
          lt: startOfDay,
        },
      },
    });

    // Average order value
    const averageOrder = totalOrders > 0 ? todayRevenue / totalOrders : 0;
    const averageOrderYesterday = totalOrdersYesterday > 0 ? yesterdayRevenue / totalOrdersYesterday : 0;

    // Calculate growth percentages
    const revenueGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
    const ordersGrowth = totalOrdersYesterday > 0 ? ((totalOrders - totalOrdersYesterday) / totalOrdersYesterday) * 100 : 0;
    const pendingGrowth = pendingOrdersYesterday > 0 ? ((pendingOrders - pendingOrdersYesterday) / pendingOrdersYesterday) * 100 : 0;
    const averageGrowth = averageOrderYesterday > 0 ? ((averageOrder - averageOrderYesterday) / averageOrderYesterday) * 100 : 0;

    res.json({
      todayRevenue,
      totalOrders,
      pendingOrders,
      averageOrder,
      revenueGrowth,
      ordersGrowth,
      pendingGrowth,
      averageGrowth,
    });

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
};

// Get revenue data for chart (hourly breakdown)
export const getRevenueData = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get today's orders
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
        paymentStatus: "PAID",
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    // Group orders by hour
    const hourlyRevenue = Array.from({ length: 24 }, (_, hour) => ({
      time: `${hour.toString().padStart(2, '0')}:00`,
      revenue: 0,
    }));

    todayOrders.forEach(order => {
      const hour = order.createdAt.getHours();
      hourlyRevenue[hour].revenue += parseFloat(order.totalAmount);
    });

    // Filter to show only every 3 hours for cleaner chart
    const filteredData = hourlyRevenue.filter((_, index) => index % 3 === 0);

    res.json(filteredData);

  } catch (error) {
    console.error("Error fetching revenue data:", error);
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
};

// Get recent orders for dashboard
export const getRecentOrdersForDashboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            pizza: {
              select: {
                name: true,
              },
            },
            combo: {
              select: {
                name: true,
              },
            },
            otherItem: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const formattedOrders = orders.map(order => ({
      id: order.id,
      customerName: order.customerName,
      totalAmount: parseFloat(order.totalAmount),
      status: order.status,
      createdAt: order.createdAt,
      orderItems: order.orderItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        pizza: item.pizza,
        combo: item.combo,
        otherItem: item.otherItem,
      })),
    }));

    res.json(formattedOrders);

  } catch (error) {
    console.error("Error fetching recent orders:", error);
    res.status(500).json({ error: "Failed to fetch recent orders" });
  }
};

// Get monthly revenue data
export const getMonthlyRevenue = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const monthlyData = [];

    for (let month = 0; month < 12; month++) {
      const startOfMonth = new Date(currentYear, month, 1);
      const endOfMonth = new Date(currentYear, month + 1, 1);

      const monthOrders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
          paymentStatus: "PAID",
        },
      });

      const monthRevenue = monthOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

      monthlyData.push({
        month: new Date(currentYear, month, 1).toLocaleString('default', { month: 'short' }),
        revenue: monthRevenue,
        orders: monthOrders.length,
      });
    }

    res.json(monthlyData);

  } catch (error) {
    console.error("Error fetching monthly revenue:", error);
    res.status(500).json({ error: "Failed to fetch monthly revenue data" });
  }
};

// Get top selling items
export const getTopSellingItems = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get pizza sales
    const pizzaSales = await prisma.orderItem.groupBy({
      by: ['pizzaId'],
      where: {
        pizzaId: {
          not: null,
        },
      },
      _sum: {
        quantity: true,
      },
      _count: {
        pizzaId: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    // Get pizza details
    const pizzaIds = pizzaSales.map(sale => sale.pizzaId);
    const pizzas = await prisma.pizza.findMany({
      where: {
        id: {
          in: pizzaIds,
        },
      },
    });

    const topPizzas = pizzaSales.map(sale => {
      const pizza = pizzas.find(p => p.id === sale.pizzaId);
      return {
        id: sale.pizzaId,
        name: pizza?.name || 'Unknown Pizza',
        type: 'pizza',
        totalQuantity: sale._sum.quantity,
        totalOrders: sale._count.pizzaId,
      };
    });

    res.json(topPizzas);

  } catch (error) {
    console.error("Error fetching top selling items:", error);
    res.status(500).json({ error: "Failed to fetch top selling items" });
  }
};

// Get order status distribution
export const getOrderStatusDistribution = async (req, res) => {
  try {
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const distribution = statusCounts.map(status => ({
      status: status.status,
      count: status._count.status,
    }));

    res.json(distribution);

  } catch (error) {
    console.error("Error fetching order status distribution:", error);
    res.status(500).json({ error: "Failed to fetch order status distribution" });
  }
};
