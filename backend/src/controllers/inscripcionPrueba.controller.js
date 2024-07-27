const Inscripcion = require("../models/inscripcion.model");
const User = require("../models/user.model");
const { respondSuccess, respondError } = require("../utils/resHandler");
const { inscripcionSchema } = require("../schema/inscripcion.schema");
const sendMail = require("../utils/nodemailer");
const Joi = require("joi");

// Obtiene todas las inscripciones
exports.getAllInscripciones = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // filtros adicionales
  const filters = {};
  if (req.query.estado) {
    filters.estado = req.query.estado;
  }

  try {
    const inscripciones = await Inscripcion.find().skip(skip).limit(limit);
    const total = await Inscripcion.countDocuments(filters);
    // respondSuccess(req, res, 200, inscripciones);
    respondSuccess(req, res, 200, {
      total,
      page,
      pages: Math.ceil(total / limit),
      inscripciones,
    });
  } catch (error) {
    respondError(req, res, 500, "Error al obtener las inscripciones");
  }
};

// Obtiene una inscripción por ID
exports.getInscripcionById = async (req, res) => {
  try {
    const { id } = req.params;
    const inscripcion = await Inscripcion.findById(id);
    if (!inscripcion) {
      return respondError(req, res, 404, "Inscripción no encontrada");
    }
    respondSuccess(req, res, 200, inscripcion);
  } catch (error) {
    respondError(req, res, 500, "Error al obtener la inscripción");
  }
};

// Crea una nueva inscripción
exports.createInscripcion = async (req, res) => {
  try {
    //aqui iba la validacion manual
    console.log("Datos recibidos para crear inscripción:", req.body);
    const { error, value } = inscripcionSchema.validate(req.body);
    if (error) {
      console.error("Error en la validación:", error.details[0].message);
      return respondError(req, res, 400, error.details[0].message);
    }

    const nuevaInscripcion = new Inscripcion({
      ...value,
      fechaCreacion: new Date(),
    });
    const inscripcion = await nuevaInscripcion.save();
    console.log("Inscripción creada exitosamente:", inscripcion);
    respondSuccess(req, res, 201, inscripcion);
  } catch (error) {
    console.error("Error al crear la inscripción:", error);
    respondError(req, res, 500, "Error al crear la inscripción");
  }
};

// Actualiza una inscripción existente
exports.updateInscripcion = async (req, res) => {
  console.log(
    "Solicitud para actualizar inscripción recibida",
    req.params,
    req.body,
  );
  const { id } = req.params;
  const { estado, comentario } = req.body;

  try {
    console.log("Validando datos de la solicitud");
    // Usa Joi para validar el objeto completo
    const { error, value } = Joi.object({
      estado: Joi.string().valid("pendiente", "aprobada", "rechazada", "sin inscripciones").required(),
      comentario: Joi.string().required(),
    }).validate({ estado, comentario });

    if (error) {
      console.log("Error de validación:", error.details[0].message);
      return respondError(req, res, 400, error.details[0].message);
    }

    console.log("Actualizando inscripción en la base de datos");
    const inscripcion = await Inscripcion.findByIdAndUpdate(
      id,
      { estado: value.estado, comentario: value.comentario },
      { new: true },
    );
    if (!inscripcion) {
      console.log("Inscripción no encontrada");
      return respondError(req, res, 404, "Inscripción no encontrada");
    }

    // Enviar correo de notificación
    console.log("Enviando correo de notificación");
    const user = await User.findById(inscripcion.userId); // Asegúrate de que `user` esté correctamente inicializado
    if (user) {
      const subject = "Estado de tu postulación";
      const text = `Hola ${user.nombre},\n\nTu postulación ha sido ${estado}.\n\nComentario: ${comentario}`;
      await sendMail(user.email, subject, text);

      // Asigna rol de emprendedor si es aceptada
      if (estado === "aceptado") {
        console.log("Asignando rol de emprendedor al usuario");
        user.role = "emprendedor";
        await user.save();
      }
    } else {
      console.log("Usuario no encontrado para enviar correo de notificación");
    }

    console.log("Solicitud procesada exitosamente");
    respondSuccess(req, res, 200, inscripcion);
  } catch (error) {
    console.error("Error al actualizar la inscripción:", error);
    respondError(req, res, 500, "Error al actualizar la inscripción");
  }
};

// Elimina una inscripción por ID
exports.deleteInscripcion = async (req, res) => {
  const { id } = req.params;

  try {
    const inscripcion = await Inscripcion.findByIdAndDelete(id);
    if (!inscripcion) {
      return respondError(req, res, 404, "Inscripción no encontrada");
    }
    respondSuccess(req, res, 200, {
      message: "Inscripción eliminada exitosamente",
    });
  } catch (error) {
    respondError(req, res, 500, "Error al eliminar la inscripción");
  }
};
