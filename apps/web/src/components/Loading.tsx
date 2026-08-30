import { Box, CircularProgress } from "@mui/material";
import { makeStyles } from "@mui/styles";

const useStyles = makeStyles(() => ({
  root: {
    margin: 4,
    textAlign: "center",
  },
}));

const Loading = () => {
  const classes = useStyles();
  return (
    <Box className={classes.root}>
      <CircularProgress size={30} />
    </Box>
  );
};

export default Loading;
