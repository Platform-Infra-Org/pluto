import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  word: {
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
});

export const LogoFull = () => {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <span className={classes.mark} />
      <span className={classes.word}>Platform</span>
    </div>
  );
};
