const { Error, Image } = require("../models");

const {
  IssueService: {
    getIssueById,
    getIssuesByUserId,
    getAllIssues,
    getAllIssuesByDepartment,
    getAllIssuesByPhrase,
    createIssue,
  },
  FileService: { uploadImages, updateImageIssueId, saveImages },
  UserService: { getUserById },
} = require("../services");

const {
  validations: {
    issueValidations: { validateUserData },
  },
  helpers: {
    issuesHelper: { filterIssueProperties },
  },
} = require("../misc");

/** Threshold value for reports count on an issue  */
const ISSUE_REPORTS_THRESHOLD = 75;
/** Threshold value for code of conduct violations by users  */
const USER_VIOLATIONS_THRESHOLD = 5;

/**
 * Controller to handle get all the issues
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const getAllIssuesController = async function (req, res) {
  let issues = null;
  const { id, role, department } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  const pageNumber = page < 1 ? 0 : page - 1;
  const pageLimit = 2 * (limit < 5 ? 5 : limit);
  try {
    if (role === "auth_level_three") {
      issues = await getAllIssues(pageNumber, pageLimit);
    } else {
      issues = await getAllIssuesByDepartment(
        department,
        pageNumber,
        pageLimit
      );
    }
  } catch (error) {
    return res
      .status(500)
      .send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }

  res.status(200).json({
    code: "OK",
    result: "SUCCESS",
    data: {
      hasNextPage: issues.length > limit,
      hasPreviosPage: page > 1,
      issues: issues
        .slice(0, limit)
        .map((issue) => filterIssueProperties(issue, id)),
    },
  });
};

/**
 * Controller to handle get all the resolved issues
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const getAllResolvedIssuesController = async function (req, res) {
  let issues = null;
  const { id, role, department } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  const pageNumber = page < 1 ? 0 : page - 1;
  const pageLimit = 2 * (limit < 5 ? 5 : limit);
  try {
    if (role === "auth_level_three") {
      issues = await getAllIssues();
    } else {
      issues = await getAllIssuesByDepartment(
        department,
        pageLimit,
        pageNumber
      );
    }
  } catch (error) {
    return res
      .status(500)
      .send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }

  issues = issues.filter((issue) => issue.isResolved);
  res.status(200).json({
    code: "OK",
    result: "SUCCESS",
    data: {
      hasNextPage: issues.length > limit,
      hasPreviosPage: page > 1,
      issues: issues
        .slice(0, limit)
        .map((issue) => filterIssueProperties(issue, id)),
    },
  });
};

/**
 * Controller to handle get all the unresolved issues
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const getAllUnresolvedIssuesController = async function (req, res) {
  let issues = null;
  const { id, role, department } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  const pageNumber = page < 1 ? 0 : page - 1;
  const pageLimit = 2 * (limit < 5 ? 5 : limit);
  try {
    if (role === "auth_level_three") {
      issues = await getAllIssues(pageNumber, pageLimit);
    } else {
      issues = await getAllIssuesByDepartment(
        department,
        pageNumber,
        pageLimit
      );
    }
  } catch (error) {
    return res
      .status(500)
      .send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }

  issues = issues.filter((issue) => !issue.isResolved);
  res.status(200).json({
    code: "OK",
    result: "SUCCESS",
    data: {
      hasNextPage: issues.length > limit,
      hasPreviosPage: page > 1,
      issues: issues
        .slice(0, limit)
        .map((issue) => filterIssueProperties(issue, id)),
    },
  });
};

/**
 * Controller to handle get issue by ID
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const getIssueByIdController = async function (req, res) {
  let issue = null;
  const { id, role, department } = req.user;
  try {
    issue = await getIssueById(req.params.id);
    if (issue) {
      issue = filterIssueProperties(issue, id);
      if (issue.department !== department && role !== "auth_level_three")
        res.status(403).send(new Error("FORBIDDEN", "Action not allowed"));
      else {
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          issue,
        });
      }
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to handle get issue by user
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const getIssuesByUserController = async function (req, res) {
  let issues = null;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  const pageNumber = page < 1 ? 0 : page - 1;
  const pageLimit = 2 * (limit < 5 ? 5 : limit);
  try {
    issues = await getIssuesByUserId(req.user.id, pageNumber, pageLimit);
    res.status(200).json({
      code: "OK",
      result: "SUCCESS",
      data: {
        hasNextPage: issues.length > limit,
        hasPreviosPage: page > 1,
        issues: issues
          .slice(0, limit)
          .map((issue) => filterIssueProperties(issue, req.user.id)),
      },
    });
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to handle get issue containing given phrases
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const getIssuesByPhraseController = async function (req, res) {
  const { phrase } = req.body;
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (phrase.trim()) {
    const pageNumber = page < 1 ? 0 : page - 1;
    const pageLimit = 2 * (limit < 5 ? 5 : limit);
    const { id, role, department } = req.user;

    try {
      let issues = await getAllIssuesByPhrase(phrase, pageNumber, pageLimit);
      if (role === "auth_level_three") {
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          data: {
            hasNextPage: issues.length > limit,
            hasPreviosPage: page > 1,
            issues: issues
              .slice(0, limit)
              .map((issue) => filterIssueProperties(issue, id)),
          },
        });
      } else {
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          data: {
            hasNextPage: issues.length > limit,
            hasPreviosPage: page > 1,
            issues: issues
              .filter(
                ({ department, scope }) =>
                  department === department || scope === "ORGANIZATION"
              )
              .map((issue) => filterIssueProperties(issue, id)),
          },
        });
      }
    } catch (error) {
      res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
    }
  } else {
    res
      .status(400)
      .send(new Error("BAD_REQUEST", "Please provide a phrase to search"));
  }
};

/**
 * Controller to handle image uploading to file server
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const saveImagesController = function (req, res) {
  saveImages(req, res, async (err) => {
    if (err) {
      res.status(400).send(new Error("BAD_REQUEST", err.message));
      return;
    }

    const files = req.files;
    const { id } = req.user;
    if (files.length === 0) {
      return res
        .status(400)
        .send(new Error("BAD_REQUEST", "Please provide images to save"));
    }
    try {
      const data = await uploadImages(files, id);
      if (data) {
        const paths = [];
        data.files.forEach(async (file) => {
          const path = `${process.env.FILE_SERVER_URI}/${file.path}`;
          paths.push(path);

          await Image.create({
            path,
            mimetype: file.mimetype,
            userId: req.user.id,
            issueId: null,
            createdOn: file.createdOn,
          });
        });

        return res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          files: paths,
        });
      }
      res
        .status(500)
        .send(new Error("INTERNAL_SERVER_ERROR", "Something went wrong"));
    } catch (error) {
      console.log(error);
      res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
    }
  });
};

/**
 * Controller to handle add new issue
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const addIssueController = async function (req, res) {
  const { title, description, images, section, scope } = req.body;
  const { department, id } = req.user;
  try {
    const errors = validateUserData(title, description, images, section, scope);
    if (errors) {
      res.status(400).send(new Error("BAD_REQUEST", errors));
    } else {
      const issue = await createIssue(
        title,
        description,
        section,
        images,
        department,
        scope.toUpperCase(),
        id
      );
      if (images.length > 0) await updateImageIssueId(images, issue.id);

      res.status(200).json({
        code: "OK",
        result: "SUCCESS",
        message: "Issue created",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to handle updating issue
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const updateIssueController = async function (req, res) {
  const { id: userId } = req.user;
  let { title, description } = req.body;
  try {
    const issue = await getIssueById(req.params.id);
    if (issue) {
      if (issue.createdBy.toString() !== userId) {
        return res
          .status(403)
          .send(new Error("FORBIDDEN", "Action not allowed"));
      }

      title = title?.trim();
      description = description?.trim();
      if (!title && !description) {
        return res
          .status(400)
          .send(new Error("BAD_REQUEST", "Please provide some data"));
      }

      issue.title = title || issue.title;
      issue.description = description || issue.description;
      issue.isEdited = true;

      await issue.save();
      res.status(200).json({
        code: "OK",
        result: "SUCCESS",
        message: "Issue updated",
      });
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "NO issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to toggle issue resolve status
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const toggleResolveStatusController = async function (req, res) {
  let issue = null;
  const { id, role } = req.user;
  try {
    issue = await getIssueById(req.params.id);
    if (issue) {
      if (issue.createdBy.toString() === id || role === "moderator") {
        issue.isResolved = !issue.isResolved;
        await issue.save();
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          message: issue.isResolved
            ? "Issue marked as resolved"
            : "Issue marked as unresolved",
        });
      } else {
        res.status(403).send(new Error("FORBIDDEN", "Action not allowed"));
      }
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to toggle upvote
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const toggleUpvoteController = async function (req, res) {
  let issue = null;
  const { department, id: userId } = req.user;
  try {
    issue = await getIssueById(req.params.id);
    if (issue) {
      if (department !== issue.department && issue.scope !== "ORGANIZATION")
        return res
          .status(403)
          .send(new Error("FORBIDDEN", "Action not allowed"));

      let userAlreadyUpvoted = false;
      if (issue.upvoters.findIndex((id) => id.toString() === userId)) {
        issue.upvotes++;
        issue.upvoters.push(userId);
      } else {
        userAlreadyUpvoted = true;
        issue.upvotes--;
        issue.upvoters = issue.upvoters.filter(
          (id) => id.toString() !== userId
        );
      }

      await issue.save();
      res.status(200).json({
        code: "OK",
        result: "SUCCESS",
        message: userAlreadyUpvoted
          ? "Removed upvote from issue"
          : "Upvoted issue",
      });
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to toggle issue as inappropriate
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const toggleInappropriateController = async function (req, res) {
  const { id: userId, department, role } = req.user;
  let userReported = false;

  try {
    const issue = await getIssueById(req.params.id);
    if (issue) {
      if (
        issue.department === department ||
        ["auth_level_two", "auth_level_three"].includes(role)
      ) {
        if (issue.reporters.find((id) => id.toString() === userId)) {
          issue.reporters = issue.reporters.filter(
            (id) => id.toString() !== userId
          );
        } else {
          issue.reporters.push(userId);
          userReported = true;
        }

        const author = await getUserById(issue.createdBy.toString());
        if (issue.reporters.length >= ISSUE_REPORTS_THRESHOLD) {
          issue.isInappropriate = true;
          if (!author.violations.find((id) => id.toString() === issue.id)) {
            author.violations.push(issue.id);
          }
        } else {
          issue.isInappropriate = false;
          if (author.violations.find((id) => id.toString() === issue.id)) {
            author.violations = author.violations.filter(
              (id) => id.toString() !== issue.id
            );
          }
        }
        author.isDisabled =
          author.violations.length >= USER_VIOLATIONS_THRESHOLD;

        await author.save();
        await issue.save();

        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          message: userReported
            ? "Issue marked as inappropriate"
            : "Inappropriate mark for the issue removed",
        });
      } else {
        res.status(403).send(new Error("FORBIDDEN", "Action not allowed"));
      }
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to handle post comment on issue
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const postCommentController = async function (req, res) {
  let issue = null;
  const { id, department } = req.user;
  try {
    issue = await getIssueById(req.params.id);
    if (issue) {
      if (department !== issue.department && issue.scope !== "ORGANIZATION")
        res.status(403).send(new Error("FORBIDDEN", "Action not allowed"));
      else {
        const { comment } = req.body;
        if (!comment?.trim()) {
          return res
            .status(400)
            .send(
              new Error("BAD_REQUEST", "Please provide a valid comment String")
            );
        }
        issue.comments.push({ comment: comment.trim() });
        await issue.save();
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          message: "Comment posted",
        });
      }
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to handle post solution on issue
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const postSolutionController = async function (req, res) {
  let issue = null;
  const { solution } = req.body;
  if (!solution?.trim()) {
    return res
      .status(400)
      .send(new Error("BAD_REQUEST", "Please provide a valid solution string"));
  }
  const { id, role, department } = req.user;
  try {
    issue = await getIssueById(req.params.id);
    if (issue) {
      if (
        ["user", "moderator"].includes(role) ||
        (role === "auth_level_one" && department !== issue.department)
      )
        res.status(403).send(new Error("FORBIDDEN", "Action not allowed"));
      else {
        issue.solutions.push({ solution: solution.trim(), postedBy: id });
        await issue.save();
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          message: "Solution posted",
        });
      }
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

/**
 * Controller to delete issue
 * @param {Request} req Request Object
 * @param {Response} res Response Object
 */
const deleteIssueController = async function (req, res) {
  let issue = null;
  const { role, id } = req.user;
  try {
    issue = await getIssueById(req.params.id);
    if (issue) {
      if (issue.createdBy.toString() === id || role === "moderator") {
        issue.isDeleted = true;
        await issue.save();
        res.status(200).json({
          code: "OK",
          result: "SUCCESS",
          message: "Issue deleted",
        });
      } else {
        res.status(403).send(new Error("FORBIDDEN", "Action not allowed"));
      }
    } else {
      res.status(400).send(new Error("BAD_REQUEST", "No issue found"));
    }
  } catch (error) {
    res.status(500).send(new Error("INTERNAL_SERVER_ERROR", error.message));
  }
};

module.exports = {
  addIssue: addIssueController,
  getAllIssues: getAllIssuesController,
  getAllResolvedIssues: getAllResolvedIssuesController,
  getAllUnresolvedIssues: getAllUnresolvedIssuesController,
  getIssueById: getIssueByIdController,
  getIssuesByUser: getIssuesByUserController,
  getIssuesByPhrase: getIssuesByPhraseController,
  saveImagesController,
  updateIssue: updateIssueController,
  postComment: postCommentController,
  postSolution: postSolutionController,
  toggleResolveStatus: toggleResolveStatusController,
  toggleUpvote: toggleUpvoteController,
  toggleInappropriate: toggleInappropriateController,
  deleteIssue: deleteIssueController,
};
