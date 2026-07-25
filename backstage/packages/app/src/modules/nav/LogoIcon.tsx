import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
  mark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
});

export const LogoIcon = () => {
  const classes = useStyles();
  return <span className={classes.mark} />;
};
